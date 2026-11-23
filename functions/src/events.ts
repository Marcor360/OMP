import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { FieldValue, Timestamp, type QueryDocumentSnapshot, type Transaction } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { reserveEventShifts } from './event-shift-reservations.js';
import { readEventAudience, readEventPeople } from './event-groups.js';
import { criticalCallableOptions } from './shared/callable-security.js';
import {
  EVENT_AUDIENCES, EVENT_CATEGORIES, EVENT_LIMITS, eventDay, isEventDay, isEventId, isEventTeamSize, validateEventSchedules,
  type EventAudience, type EventCategory, type EventSchedule,
} from './shared/event-planning.js';
import { adminDb } from './config/firebaseAdmin.js';
import { deleteNotificationPage } from './maintenance/delete-notification-page.js';
import { buildNotificationUrl } from './modules/notifications/notification-routes.js';
import { canManageEvents } from './shared/events-access.js';
import type { EventsAvisosAction } from './shared/events-access.js';
import { assertAdministrativeBillingAccess } from './users/authorization.js';

type EventType =
  | 'conmemoracion'
  | 'asamblea_circuito'
  | 'asamblea_regional'
  | 'visita_superintendente'
  | 'reunion_especial'
  | 'capacitacion'
  | 'personalizado'
  | 'reunion_anual_precursores'
  | 'reunion_precursores_visita_superintendente'
  | 'reunion_ancianos_siervos_ministeriales';

const REGION = 'us-central1';
const TIME_ZONE = 'America/Mexico_City';
const EVENTS_COLLECTION = 'events';
const NOTIFICATIONS_COLLECTION = 'notifications';
const PAGE_SIZE = 400;
const MEXICO_CITY_OFFSET = '-06:00';

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  conmemoracion: 'Conmemoracion',
  asamblea_circuito: 'Asamblea de Circuito',
  asamblea_regional: 'Asamblea Regional',
  visita_superintendente: 'Visita del Superintendente de Circuito',
  reunion_especial: 'Reunion Especial',
  capacitacion: 'Capacitacion',
  personalizado: 'Evento personalizado',
  reunion_anual_precursores: 'Reunion Anual de Precursores',
  reunion_precursores_visita_superintendente: 'Reunion con Precursores - Visita del Superintendente',
  reunion_ancianos_siervos_ministeriales: 'Reunion con Ancianos y Siervos Ministeriales',
};

const EVENT_TYPE_COLORS: Record<EventType, string> = {
  conmemoracion: '#8B1E3F',
  asamblea_circuito: '#2563EB',
  asamblea_regional: '#7C3AED',
  visita_superintendente: '#16A34A',
  reunion_especial: '#F97316',
  capacitacion: '#0D9488',
  personalizado: '#7C3AED',
  reunion_anual_precursores: '#6366F1',
  reunion_precursores_visita_superintendente: '#0891B2',
  reunion_ancianos_siervos_ministeriales: '#9333EA',
};

const SINGLE_DAY_EVENT_TYPES = new Set<EventType>([
  'conmemoracion',
  'asamblea_circuito',
  'reunion_anual_precursores',
  'reunion_precursores_visita_superintendente',
  'reunion_ancianos_siervos_ministeriales',
]);

const OPTIONAL_END_DATE_EVENT_TYPES = new Set<EventType>([
  'reunion_especial',
  'capacitacion',
  'personalizado',
]);

type EventWritePayload = {
  congregationId: unknown;
  eventId?: unknown;
  requestId?: unknown;
  expectedRevision?: unknown;
  eventData: {
    type?: unknown;
    title?: unknown;
    superintendentName?: unknown;
    superintendentWifeName?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    location?: unknown;
    categories?: unknown;
    schedules?: unknown;
    audience?: unknown;
  };
};

const isEventType = (value: unknown): value is EventType =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(EVENT_TYPE_LABELS, value);

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseRequiredString = (value: unknown, fieldName: string): string => {
  const parsed = asNonEmptyString(value);
  if (!parsed) {
    throw new HttpsError('invalid-argument', `${fieldName} es requerido.`);
  }

  return parsed;
};

const parseOptionalString = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', 'Uno de los campos tiene formato invalido.');
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseEventType = (value: unknown): EventType => {
  if (!isEventType(value)) {
    throw new HttpsError('invalid-argument', 'Tipo de evento invalido.');
  }

  return value;
};

const parseDateInput = (value: unknown, fieldName: string): string => {
  const parsed = parseRequiredString(value, fieldName);
  if (!isEventDay(parsed)) {
    throw new HttpsError('invalid-argument', `${fieldName} debe usar formato YYYY-MM-DD.`);
  }

  return parsed;
};

const toMexicoCityTimestamp = (dateInput: string): Timestamp => {
  const date = new Date(`${dateInput}T00:00:00${MEXICO_CITY_OFFSET}`);
  if (!Number.isFinite(date.getTime())) {
    throw new HttpsError('invalid-argument', 'Fecha invalida.');
  }

  return Timestamp.fromDate(date);
};

const addDays = (timestamp: Timestamp, days: number): Timestamp => {
  const date = timestamp.toDate();
  date.setUTCDate(date.getUTCDate() + days);
  return Timestamp.fromDate(date);
};

const planningErrors = {
  unappliedHours: 'Aplica los cambios de horario antes de publicar.',
  invalidSchedule: 'Revisa el nombre, horario, duración y cantidad de personas de cada lista.',
  scheduleDate: 'La fecha de cada lista debe estar dentro del evento.',
  incompleteShift: 'Completa todos los turnos con personas distintas en cada turno.',
  overlappingShifts: 'Una persona tiene dos turnos que se traslapan.',
  tooManyPeople: 'El evento tiene demasiadas personas asignadas.',
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', 'Los datos de planificación no son válidos.');
  }
  return value as Record<string, unknown>;
};

function parseSchedules(value: unknown, start: string, end: string): EventSchedule[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > EVENT_LIMITS.schedules) {
    throw new HttpsError('invalid-argument', planningErrors.invalidSchedule);
  }
  const schedules = value.map((entry) => {
    const schedule = asRecord(entry);
    const { name, date, startTime, endTime, minutesPerShift, teamSize, teams } = schedule;
    if (schedule.pendingHours) throw new HttpsError('invalid-argument', planningErrors.unappliedHours);
    if (typeof name !== 'string' || typeof date !== 'string' || typeof startTime !== 'string'
      || typeof endTime !== 'string' || typeof minutesPerShift !== 'number' || typeof teamSize !== 'number'
      || !Array.isArray(teams) || teams.length > EVENT_LIMITS.shifts) {
      throw new HttpsError('invalid-argument', planningErrors.invalidSchedule);
    }
    return {
      name: name.trim(), date, startTime, endTime, minutesPerShift, teamSize,
      teams: teams.map((entry) => {
        const { memberIds, capacity } = asRecord(entry);
        if (capacity !== undefined && !isEventTeamSize(capacity)) {
          throw new HttpsError('invalid-argument', planningErrors.invalidSchedule);
        }
        if (!Array.isArray(memberIds) || memberIds.length > EVENT_LIMITS.teamSize || !memberIds.every(isEventId)) {
          throw new HttpsError('invalid-argument', planningErrors.incompleteShift);
        }
        return capacity === undefined || capacity === teamSize ? { memberIds } : { memberIds, capacity };
      }),
    };
  });
  const error = validateEventSchedules(schedules, start, end);
  if (error) throw new HttpsError('invalid-argument', planningErrors[error]);
  return schedules;
}

function parsePlanning(raw: EventWritePayload['eventData'], start: string, end: string) {
  const categories = raw.categories ?? [];
  if (!Array.isArray(categories) || (raw.type === 'personalizado' && !categories.length) || categories.length > EVENT_CATEGORIES.length
    || categories.some((category) => !EVENT_CATEGORIES.includes(category))) {
    throw new HttpsError('invalid-argument', 'Selecciona categorías válidas.');
  }
  const audience = asRecord(raw.audience ?? { kind: 'congregation' });
  if (!EVENT_AUDIENCES.includes(audience.kind as EventAudience['kind'])
    || (audience.kind !== 'congregation' && !isEventId(audience.groupId))) {
    throw new HttpsError('invalid-argument', 'Selecciona un alcance válido para el evento.');
  }
  return {
    categories: EVENT_CATEGORIES.filter((category: EventCategory) => categories.includes(category)),
    schedules: parseSchedules(raw.schedules, start, end),
    audience: { kind: audience.kind, groupId: audience.groupId } as EventAudience,
  };
}

async function resolvePlanning(transaction: Transaction, congregationId: string, plan: ReturnType<typeof parsePlanning>) {
  const peopleIds = [...new Set(plan.schedules.flatMap((schedule) => schedule.teams.flatMap((team) => team.memberIds)))];
  const [people, audience] = await Promise.all([
    readEventPeople(transaction, congregationId, peopleIds),
    readEventAudience(transaction, congregationId, plan.audience),
  ]);
  return {
    categories: plan.categories,
    audience,
    schedules: plan.schedules.map((schedule) => {
      const scheduleIds = new Set(schedule.teams.flatMap((team) => team.memberIds));
      return { ...schedule, people: people.filter((person) => scheduleIds.has(person.uid)) };
    }),
  };
}

const parseEventData = (raw: EventWritePayload['eventData']) => {
  if (!raw || typeof raw !== 'object') {
    throw new HttpsError('invalid-argument', 'Datos de evento invalidos.');
  }

  const type = parseEventType(raw.type);
  const startDateInput = parseDateInput(raw.startDate, 'Fecha inicial');
  const requestedEndDate = parseOptionalString(raw.endDate);
  const endDateInput = SINGLE_DAY_EVENT_TYPES.has(type)
    ? startDateInput
    : OPTIONAL_END_DATE_EVENT_TYPES.has(type) && !requestedEndDate
      ? startDateInput
      : parseDateInput(requestedEndDate, 'Fecha final');
  if (startDateInput < eventDay(new Date())) {
    throw new HttpsError('failed-precondition', 'La fecha inicial no puede estar en el pasado.');
  }
  const planning = parsePlanning(raw, startDateInput, endDateInput);
  const startDate = toMexicoCityTimestamp(startDateInput);
  const endDate = toMexicoCityTimestamp(endDateInput);

  if (endDate.toMillis() < startDate.toMillis()) {
    throw new HttpsError(
      'invalid-argument',
      'La fecha final no puede ser menor que la fecha inicial.'
    );
  }

  const title = parseOptionalString(raw.title);
  const superintendentName = parseOptionalString(raw.superintendentName);
  const superintendentWifeName = parseOptionalString(raw.superintendentWifeName);
  const location = parseOptionalString(raw.location);
  if ([title, location, superintendentName, superintendentWifeName].some((value) => value && value.length > 200)) {
    throw new HttpsError('invalid-argument', 'El texto del evento no puede superar 200 caracteres por campo.');
  }

  if (type === 'visita_superintendente') {
    if (!superintendentName) {
      throw new HttpsError('invalid-argument', 'El nombre del superintendente es requerido.');
    }

    return {
      type,
      superintendentName,
      superintendentWifeName,
      location,
      planning,
      startDate,
      endDate,
      deleteAt: addDays(endDate, 1),
      color: EVENT_TYPE_COLORS[type],
    };
  }

  if (!title) {
    throw new HttpsError('invalid-argument', 'El titulo del evento es requerido.');
  }

  return {
    type,
    title,
    location,
    planning,
    startDate,
    endDate,
    deleteAt: addDays(endDate, 1),
    color: EVENT_TYPE_COLORS[type],
  };
};

const getRequesterProfile = async (uid: string): Promise<Record<string, unknown>> => {
  const snap = await adminDb.collection('users').doc(uid).get();

  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'No se encontro tu perfil.');
  }

  return snap.data() as Record<string, unknown>;
};

const readAvisosPermission = (
  requester: Record<string, unknown>
): ((action: EventsAvisosAction) => boolean) => {
  const permissions = requester.permissions;
  if (typeof permissions !== 'object' || permissions === null || Array.isArray(permissions)) {
    return () => false;
  }
  const avisos = (permissions as Record<string, unknown>).avisos;
  if (typeof avisos !== 'object' || avisos === null || Array.isArray(avisos)) {
    return () => false;
  }
  const block = avisos as Record<string, unknown>;
  return (action) => block[action] === true || block.manage === true;
};

const assertEventManager = async (params: {
  requester: Record<string, unknown>;
  congregationId: string;
}): Promise<void> => {
  const requesterCongregationId = asNonEmptyString(params.requester.congregationId);
  const isActive = params.requester.isActive === true;

  if (!isActive || requesterCongregationId !== params.congregationId) {
    throw new HttpsError('permission-denied', 'No tienes permisos para realizar esta operacion.');
  }

  const allowed = canManageEvents(
    {
      role: typeof params.requester.role === 'string' ? params.requester.role : undefined,
      isActive,
      congregationId: requesterCongregationId,
    },
    { hasAvisosPermission: readAvisosPermission(params.requester) }
  );

  if (!allowed) {
    throw new HttpsError('permission-denied', 'No tienes permisos para administrar eventos.');
  }

  await assertAdministrativeBillingAccess(params.congregationId);
};

export const listEventPlanningPeople = onCall(criticalCallableOptions, async (request): Promise<{ people: { uid: string; name: string }[] }> => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  const congregationId = request.data?.congregationId;
  if (!isEventId(congregationId)) throw new HttpsError('invalid-argument', 'Congregación inválida.');
  const requester = await getRequesterProfile(uid);
  await assertEventManager({ requester, congregationId });
  const profiles = await adminDb.collection('users').where('congregationId', '==', congregationId)
    .where('isActive', '==', true).select('displayName').get();
  return {
    people: profiles.docs.flatMap((profile) => {
      const name = asNonEmptyString(profile.get('displayName'));
      return name ? [{ uid: profile.id, name }] : [];
    }),
  };
});

const cleanUndefined = (value: Record<string, unknown>): Record<string, unknown> => {
  const output: Record<string, unknown> = {};
  Object.entries(value).forEach(([key, child]) => {
    if (child !== undefined && child !== null) {
      output[key] = child;
    }
  });
  return output;
};

export const createEventByManager = onCall(
  {
    ...criticalCallableOptions,
    timeoutSeconds: 60,
    memory: '256MiB',
    maxInstances: 3,
  },
  async (request): Promise<{ eventId: string }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = (request.data ?? {}) as EventWritePayload;
    const congregationId = parseRequiredString(payload.congregationId, 'congregationId');
    if (!isEventId(congregationId)) throw new HttpsError('invalid-argument', 'Identificador de congregación inválido.');
    const requester = await getRequesterProfile(request.auth.uid);
    await assertEventManager({ requester, congregationId });

    const uid = request.auth.uid;
    if (payload.requestId !== undefined && (typeof payload.requestId !== 'string'
      || !/^[a-f0-9-]{36}$/i.test(payload.requestId))) {
      throw new HttpsError('invalid-argument', 'El identificador de guardado no es válido.');
    }
    const events = adminDb.collection(EVENTS_COLLECTION);
    const ref = typeof payload.requestId === 'string'
      ? events.doc(createHash('sha256').update(JSON.stringify([congregationId, uid, payload.requestId])).digest('hex'))
      : events.doc();
    try {
      await adminDb.runTransaction(async (transaction) => {
        if (payload.requestId && (await transaction.get(ref)).exists) return;
        const { planning, ...eventData } = parseEventData(payload.eventData);
        const resolved = await resolvePlanning(transaction, congregationId, planning);
        await reserveEventShifts(transaction, congregationId, ref.id, [], resolved.schedules);
        transaction.create(ref, cleanUndefined({
          congregationId, ...eventData, ...resolved, revision: 1, createdBy: uid,
          createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        }));
      });
    } catch (error) {
      // These validation errors occur after the transaction checks the request ID.
      if (error instanceof HttpsError) {
        throw new HttpsError(error.code, error.message, { publicationNotCommitted: true });
      }
      throw error;
    }
    return { eventId: ref.id };
  }
);

export const updateEventByManager = onCall(
  {
    ...criticalCallableOptions,
    timeoutSeconds: 60,
    memory: '256MiB',
    maxInstances: 3,
  },
  async (request): Promise<{ ok: true }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = (request.data ?? {}) as EventWritePayload;
    const congregationId = parseRequiredString(payload.congregationId, 'congregationId');
    const eventId = parseRequiredString(payload.eventId, 'eventId');
    if (!isEventId(congregationId)) throw new HttpsError('invalid-argument', 'Identificador de congregación inválido.');
    const requester = await getRequesterProfile(request.auth.uid);
    await assertEventManager({ requester, congregationId });

    if (!isEventId(eventId)) throw new HttpsError('invalid-argument', 'Identificador de evento inválido.');
    const uid = request.auth.uid;
    const ref = adminDb.collection(EVENTS_COLLECTION).doc(eventId);
    await adminDb.runTransaction(async (transaction) => {
      const existing = (await transaction.get(ref)).data();
      if (!existing) throw new HttpsError('not-found', 'Evento no encontrado.');
      if (existing.congregationId !== congregationId) {
        throw new HttpsError('permission-denied', 'No tienes permisos para editar este evento.');
      }
      const revision = typeof existing.revision === 'number' ? existing.revision : 0;
      const expected = payload.expectedRevision;
      if (expected !== revision && !(expected === undefined && !existing.schedules?.length
        && !existing.categories?.length && (!existing.audience || existing.audience.kind === 'congregation'))) {
        throw new HttpsError('aborted', 'Otra persona actualizó el evento. Vuelve a abrirlo antes de guardar.');
      }
      const { planning, ...eventData } = parseEventData(payload.eventData);
      const resolved = await resolvePlanning(transaction, congregationId, planning);
      const next = cleanUndefined({ ...eventData, ...resolved });
      if (!hasMaterialChange(existing, next)) return;
      await reserveEventShifts(transaction, congregationId, eventId, existing.schedules ?? [], resolved.schedules);
      transaction.set(ref, {
        ...next, congregationId, createdBy: existing.createdBy, createdAt: existing.createdAt,
        revision: revision + 1, updatedBy: uid, updatedAt: FieldValue.serverTimestamp(),
      });
    });
    return { ok: true };
  }
);

export const deleteEventByManager = onCall(
  {
    ...criticalCallableOptions,
    timeoutSeconds: 60,
    memory: '256MiB',
    maxInstances: 3,
  },
  async (request): Promise<{ ok: true }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = (request.data ?? {}) as EventWritePayload;
    const congregationId = parseRequiredString(payload.congregationId, 'congregationId');
    const eventId = parseRequiredString(payload.eventId, 'eventId');
    if (!isEventId(congregationId)) throw new HttpsError('invalid-argument', 'Identificador de congregación inválido.');
    const requester = await getRequesterProfile(request.auth.uid);
    await assertEventManager({ requester, congregationId });

    if (!isEventId(eventId)) throw new HttpsError('invalid-argument', 'Identificador de evento inválido.');
    const ref = adminDb.collection(EVENTS_COLLECTION).doc(eventId);
    await adminDb.runTransaction(async (transaction) => {
      const existing = (await transaction.get(ref)).data();
      if (!existing) return;
      if (existing.congregationId !== congregationId) {
        throw new HttpsError('permission-denied', 'No tienes permisos para eliminar este evento.');
      }
      await reserveEventShifts(transaction, congregationId, eventId, existing.schedules ?? [], []);
      transaction.delete(ref);
    });
    return { ok: true };
  }
);

const formatDate = (timestamp: unknown): string => {
  if (!(timestamp instanceof Timestamp)) return '';

  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    timeZone: TIME_ZONE,
  }).format(timestamp.toDate());
};

const buildNotificationMessage = (
  eventId: string,
  data: Record<string, unknown>,
  isUpdate: boolean
) => {
  const type = isEventType(data.type) ? data.type : 'reunion_especial';
  const title = asNonEmptyString(data.title);
  const startLabel = formatDate(data.startDate);
  const endLabel = formatDate(data.endDate);
  const sameDay = startLabel === endLabel || endLabel.length === 0;
  const url = buildNotificationUrl({ type: 'event', category: null, eventId });

  if (type === 'conmemoracion') {
    return {
      title: isUpdate ? 'Conmemoracion actualizada' : 'Conmemoracion',
      body: 'Ya esta disponible la informacion de la Conmemoracion.',
      url,
    };
  }

  if (type === 'visita_superintendente') {
    return {
      title: isUpdate
        ? 'Visita del Superintendente actualizada'
        : 'Visita del Superintendente de Circuito',
      body: sameDay
        ? `La visita sera el ${startLabel}.`
        : `La visita sera del ${startLabel} al ${endLabel}.`,
      url,
    };
  }

  if (type === 'asamblea_circuito' || type === 'asamblea_regional') {
    return {
      title: isUpdate ? 'Asamblea actualizada' : 'Asamblea',
      body: 'Ya esta disponible la informacion del evento.',
      url,
    };
  }

  return {
    title: isUpdate ? 'Evento actualizado' : 'Nueva informacion de evento',
    body: isUpdate
      ? `Se actualizo ${title ?? EVENT_TYPE_LABELS[type]}.`
      : 'Se ha agregado un nuevo evento para la congregacion.',
    url,
  };
};

export const MATERIAL_EVENT_FIELDS = [
  'type',
  'title',
  'location',
  'superintendentName',
  'superintendentWifeName',
  'startDate',
  'endDate',
  'categories',
  'schedules',
  'audience',
] as const;

export const hasMaterialChange = (
  before: Record<string, unknown> | null,
  after: Record<string, unknown>
): boolean => {
  if (!before) return true;

  return MATERIAL_EVENT_FIELDS.some((field) => {
    const previous = before[field];
    const next = after[field];

    if (previous instanceof Timestamp && next instanceof Timestamp) {
      return !previous.isEqual(next);
    }

    return !isDeepStrictEqual(previous, next);
  });
};

const chunk = <T>(items: readonly T[], size: number): T[][] =>
  items.reduce<T[][]>((groups, item, index) => {
    if (index % size === 0) groups.push([]);
    groups[groups.length - 1].push(item);
    return groups;
  }, []);

const getEventNotificationTargets = async (
  congregationId: string, data: Record<string, unknown>
): Promise<string[]> => {
  const audience = data.audience as { kind?: string; memberIds?: unknown[] } | undefined;
  let profiles;
  if (audience?.kind && audience.kind !== 'congregation') {
    const schedules = data.schedules as { people?: { uid?: unknown }[] }[] | undefined;
    const ids = new Set([
      ...(audience.memberIds ?? []),
      ...(schedules ?? []).flatMap((schedule) => (schedule.people ?? []).map((person) => person.uid)),
    ].filter(isEventId));
    profiles = (await Promise.all(chunk([...ids], 100).map((group) =>
      adminDb.getAll(...group.map((id) => adminDb.collection('users').doc(id)))))).flat();
  } else {
    profiles = (await adminDb.collection('users')
      .where('congregationId', '==', congregationId).where('isActive', '==', true).get()).docs;
  }
  return profiles
    .filter((docSnap) => {
      const data = docSnap.data();
      return data?.congregationId === congregationId && data.isActive === true && data.notificationsEnabled !== false && data.eventsNotifications !== false;
    })
    .map((docSnap) => docSnap.id);
};

const createNotificationDocs = async (params: {
  eventId: string;
  congregationId: string;
  userIds: string[];
  title: string;
  body: string;
  url: string;
  eventType: EventType;
  version: Timestamp;
  actorId: string | null;
}) => {
  if (params.userIds.length === 0) {
    return;
  }

  // El ID determinista hace que una edicion material actualice el aviso previo.
  // Al no crear otro documento, onDocumentCreated no vuelve a enviar push.
  const eventNotificationId = `event_${params.eventId}`;

  for (const userIdGroup of chunk(params.userIds, PAGE_SIZE)) {
    const eventRef = adminDb.collection(EVENTS_COLLECTION).doc(params.eventId);
    await adminDb.runTransaction(async (transaction) => {
      const current = await transaction.get(eventRef);
      if (!current.updateTime?.isEqual(params.version)) return;
      for (const userId of userIdGroup) {
        const notificationId = `${eventNotificationId}_${userId}`;
        const ref = adminDb.collection('congregations').doc(params.congregationId)
          .collection(NOTIFICATIONS_COLLECTION).doc(notificationId);
        transaction.set(ref, {
          userId, congregationId: params.congregationId, type: 'event', eventId: params.eventId, eventType: params.eventType,
          title: params.title, body: params.body, isRead: false, createdAt: FieldValue.serverTimestamp(),
          sentBy: params.actorId, data: { url: params.url }, notificationId, userIds: [userId],
        });
      }
    });
  }
};

export const notifyEventChanges = onDocumentWritten(
  {
    region: REGION,
    timeoutSeconds: 60,
    memory: '256MiB',
    maxInstances: 3,
    document: 'events/{eventId}',
  },
  async (event) => {
    if (event.data?.before.exists && !event.data.after.exists) {
      const eventId = event.params.eventId;
      const before = event.data.before.data() as Record<string, unknown>;
      const congregationId = asNonEmptyString(before.congregationId);
      if (eventId && congregationId) {
        const deletedNotifications = await deleteRelatedNotifications(
          congregationId,
          eventId
        );
        logger.info('Event related notifications deleted after manual removal', {
          eventId,
          deletedNotifications,
        });
      }
      return;
    }

    if (!event.data?.after.exists) {
      return;
    }

    const eventId = event.params.eventId;
    const after = event.data.after.data() as Record<string, unknown>;
    const version = event.data.after.updateTime;
    const congregationId = asNonEmptyString(after.congregationId);
    const eventType = isEventType(after.type) ? after.type : null;

    if (!eventId || !congregationId || !eventType || !version) {
      return;
    }

    const isUpdate = event.data.before.exists;

    if (
      isUpdate &&
      !hasMaterialChange(
        event.data.before.data() as Record<string, unknown>,
        after
      )
    ) {
      logger.debug('Event write skipped: no material change', {
        eventId,
        congregationId,
      });
      return;
    }

    const message = buildNotificationMessage(eventId, after, isUpdate);
    const userIds = await getEventNotificationTargets(congregationId, after);
    const actorId =
      asNonEmptyString(after.updatedBy) ?? asNonEmptyString(after.createdBy);

    await createNotificationDocs({
      eventId,
      congregationId,
      userIds,
      title: message.title,
      body: message.body,
      url: message.url,
      eventType,
      version,
      actorId,
    });

    logger.info('Event notification created', {
      eventId,
      congregationId,
      users: userIds.length,
      isUpdate,
    });
  }
);

const deleteRelatedNotifications = async (
  congregationId: string,
  eventId: string
): Promise<number> => {
  let deleted = 0;
  let cursor: QueryDocumentSnapshot | undefined;
  const query = adminDb.collection('congregations').doc(congregationId)
    .collection(NOTIFICATIONS_COLLECTION).where('eventId', '==', eventId).limit(PAGE_SIZE);
  while (true) {
    const snapshot = await (cursor ? query.startAfter(cursor) : query).get();
    if (snapshot.empty) return deleted;
    cursor = snapshot.docs[snapshot.docs.length - 1];
    const result = await deleteNotificationPage(snapshot.docs);
    deleted += result.deleted;
    if (result.errors) logger.warn('Some event notifications remain pending cleanup', { eventId, errors: result.errors });
  }
};

export const scheduledEventsCleanup = onSchedule(
  {
    schedule: '0 0 * * *',
    timeZone: TIME_ZONE,
    region: REGION,
    timeoutSeconds: 540,
    memory: '512MiB',
    maxInstances: 1,
  },
  async () => {
    const now = Timestamp.now();
    let deletedEvents = 0;

    let cursor: QueryDocumentSnapshot | undefined;
    while (true) {
      const query = adminDb.collection(EVENTS_COLLECTION)
        .where('deleteAt', '<=', now)
        .orderBy('deleteAt', 'asc')
        .limit(PAGE_SIZE);
      const snap = await (cursor ? query.startAfter(cursor) : query).get();
      if (snap.empty) break;
      cursor = snap.docs[snap.docs.length - 1];

      for (const docSnap of snap.docs) {
        const data = docSnap.data() as Record<string, unknown>;
        const congregationId = asNonEmptyString(data.congregationId);
        if (!congregationId || congregationId.includes('/')) {
          logger.warn('Skipping event cleanup without valid congregationId', {
            eventId: docSnap.id,
          });
          continue;
        }
        try {
          const deleted = await adminDb.runTransaction(async (transaction) => {
            const current = await transaction.get(docSnap.ref);
            if (!current.updateTime?.isEqual(docSnap.updateTime)) return false;
            await reserveEventShifts(transaction, congregationId, docSnap.id, data.schedules as EventSchedule[] ?? [], []);
            transaction.delete(docSnap.ref);
            return true;
          });
          if (!deleted) continue;
          deletedEvents += 1;
        } catch (error) {
          logger.warn('Event cleanup skipped or incomplete', { eventId: docSnap.id, error });
        }
      }
    }

    logger.info('Events cleanup completed', {
      deletedEvents,
    });
  }
);
