import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { adminDb } from './config/firebaseAdmin.js';
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
]);

type EventWritePayload = {
  congregationId: unknown;
  eventId?: unknown;
  eventData: {
    type?: unknown;
    title?: unknown;
    superintendentName?: unknown;
    superintendentWifeName?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    location?: unknown;
  };
};

const isEventType = (value: unknown): value is EventType =>
  typeof value === 'string' && value in EVENT_TYPE_LABELS;

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
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

  if (type === 'visita_superintendente') {
    if (!superintendentName) {
      throw new HttpsError('invalid-argument', 'El nombre del superintendente es requerido.');
    }

    return {
      type,
      superintendentName,
      superintendentWifeName,
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
    region: REGION,
    timeoutSeconds: 60,
    memory: '256MiB',
    maxInstances: 3,
  },
  async (request): Promise<{ eventId: string }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = request.data as EventWritePayload;
    const congregationId = parseRequiredString(payload.congregationId, 'congregationId');
    const requester = await getRequesterProfile(request.auth.uid);
    await assertEventManager({ requester, congregationId });

    const eventData = parseEventData(payload.eventData);
    const ref = await adminDb.collection(EVENTS_COLLECTION).add(
      cleanUndefined({
        congregationId,
        ...eventData,
        createdBy: request.auth.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
    );

    return { eventId: ref.id };
  }
);

export const updateEventByManager = onCall(
  {
    region: REGION,
    timeoutSeconds: 60,
    memory: '256MiB',
    maxInstances: 3,
  },
  async (request): Promise<{ ok: true }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = request.data as EventWritePayload;
    const congregationId = parseRequiredString(payload.congregationId, 'congregationId');
    const eventId = parseRequiredString(payload.eventId, 'eventId');
    const requester = await getRequesterProfile(request.auth.uid);
    await assertEventManager({ requester, congregationId });

    const ref = adminDb.collection(EVENTS_COLLECTION).doc(eventId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Evento no encontrado.');
    }

    const existing = snap.data() as Record<string, unknown>;
    if (existing.congregationId !== congregationId) {
      throw new HttpsError('permission-denied', 'No tienes permisos para editar este evento.');
    }

    const eventData = parseEventData(payload.eventData);
    await ref.set(
      cleanUndefined({
        congregationId,
        ...eventData,
        createdBy: existing.createdBy,
        createdAt: existing.createdAt,
        updatedBy: request.auth.uid,
        updatedAt: FieldValue.serverTimestamp(),
      })
    );

    return { ok: true };
  }
);

export const deleteEventByManager = onCall(
  {
    region: REGION,
    timeoutSeconds: 60,
    memory: '256MiB',
    maxInstances: 3,
  },
  async (request): Promise<{ ok: true }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = request.data as EventWritePayload;
    const congregationId = parseRequiredString(payload.congregationId, 'congregationId');
    const eventId = parseRequiredString(payload.eventId, 'eventId');
    const requester = await getRequesterProfile(request.auth.uid);
    await assertEventManager({ requester, congregationId });

    const ref = adminDb.collection(EVENTS_COLLECTION).doc(eventId);
    const snap = await ref.get();
    if (!snap.exists) {
      return { ok: true };
    }

    const existing = snap.data() as Record<string, unknown>;
    if (existing.congregationId !== congregationId) {
      throw new HttpsError('permission-denied', 'No tienes permisos para eliminar este evento.');
    }

    await ref.delete();
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

const getCongregationUserIds = async (congregationId: string): Promise<string[]> => {
  const snap = await adminDb
    .collection('users')
    .where('congregationId', '==', congregationId)
    .where('isActive', '==', true)
    .get();

  return snap.docs.map((docSnap) => docSnap.id);
};

const createNotificationDocs = async (params: {
  eventId: string;
  congregationId: string;
  userIds: string[];
  title: string;
  body: string;
  url: string;
  eventType: EventType;
  actorId: string | null;
}) => {
  if (params.userIds.length === 0) {
    return;
  }

  const eventNotificationId = `event_${params.eventId}_${Date.now()}`;
  const batch = adminDb.batch();

  params.userIds.forEach((userId) => {
    const notificationId = `${eventNotificationId}_${userId}`;
    const payload = {
      userId,
      congregationId: params.congregationId,
      type: 'event',
      eventId: params.eventId,
      eventType: params.eventType,
      title: params.title,
      body: params.body,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
      sentBy: params.actorId,
      data: {
        url: params.url,
      },
    };

    batch.set(
      adminDb
        .collection('congregations')
        .doc(params.congregationId)
        .collection(NOTIFICATIONS_COLLECTION)
        .doc(notificationId),
      {
        ...payload,
        notificationId,
        userIds: [userId],
      }
    );
  });

  await batch.commit();
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
    const congregationId = asNonEmptyString(after.congregationId);
    const eventType = isEventType(after.type) ? after.type : null;

    if (!eventId || !congregationId || !eventType) {
      return;
    }

    const isUpdate = event.data.before.exists;
    const message = buildNotificationMessage(eventId, after, isUpdate);
    const userIds = await getCongregationUserIds(congregationId);
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

const deleteQueryPage = async (
  snapshot: FirebaseFirestore.QuerySnapshot
): Promise<number> => {
  if (snapshot.empty) return 0;

  const batch = adminDb.batch();
  snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();

  return snapshot.size;
};

const deleteRelatedNotifications = async (
  congregationId: string,
  eventId: string
): Promise<number> => {
  let deleted = 0;

  while (true) {
    const snap = await adminDb
      .collection('congregations')
      .doc(congregationId)
      .collection(NOTIFICATIONS_COLLECTION)
      .where('eventId', '==', eventId)
      .limit(PAGE_SIZE)
      .get();

    if (snap.empty) break;
    deleted += await deleteQueryPage(snap);
  }

  return deleted;
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
    let deletedNotifications = 0;

    while (true) {
      const snap = await adminDb
        .collection(EVENTS_COLLECTION)
        .where('deleteAt', '<=', now)
        .orderBy('deleteAt', 'asc')
        .limit(PAGE_SIZE)
        .get();

      if (snap.empty) break;

      for (const docSnap of snap.docs) {
        const data = docSnap.data() as Record<string, unknown>;
        const congregationId = asNonEmptyString(data.congregationId);
        if (!congregationId) {
          logger.warn('Skipping event cleanup without congregationId', {
            eventId: docSnap.id,
          });
          continue;
        }
        deletedNotifications += await deleteRelatedNotifications(
          congregationId,
          docSnap.id
        );
        await docSnap.ref.delete();
        deletedEvents += 1;
      }
    }

    logger.info('Events cleanup completed', {
      deletedEvents,
      deletedNotifications,
    });
  }
);
