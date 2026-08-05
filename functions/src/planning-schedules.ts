import { FieldValue, Timestamp, WriteBatch } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { adminDb } from './config/firebaseAdmin.js';

type UserRole = 'admin' | 'supervisor' | 'user';
type RequesterProfile = {
  role: UserRole;
  isActive: boolean;
  congregationId: string;
  displayName?: string;
  email?: string;
  servicePosition?: string;
  serviceDepartment?: string;
  serviceAssignments?: { position?: string; department?: string }[];
  permissions?: Record<string, Record<string, boolean> | undefined>;
};

type PublishSchedulePayload = {
  congregationId?: unknown;
  scheduleId?: unknown;
  syncMeetings?: unknown;
};

type EnsurePlanningMeetingsPayload = {
  congregationId?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  midweekDay?: unknown;
  weekendDay?: unknown;
};

type SubstituteHospitalityAssignmentPayload = {
  congregationId?: unknown;
  scheduleId?: unknown;
  itemId?: unknown;
  newUserId?: unknown;
};

type EnsurePlanningMeetingsResult = {
  ok: true;
  createdMidweek: number;
  createdWeekend: number;
  existing: number;
};

type HospitalityMeetingType = 'midweek' | 'weekend';
type HospitalityRoleKey =
  | 'chairman'
  | 'microphoneOne'
  | 'microphoneTwo'
  | 'microphoneThree'
  | 'attendantDoor'
  | 'attendantAuditorium'
  | 'attendantExtra'
  | 'watchtowerReader'
  | 'midweekBibleStudyReader'
  | 'audioVideo';

type HospitalityScheduleItem = {
  meetingDate: string;
  meetingType: HospitalityMeetingType;
  roleKey: HospitalityRoleKey;
  roleLabel: string;
  userId: string;
  userNameSnapshot: string;
};

type FirestoreRecord = Record<string, unknown>;

const HOSPITALITY_SECTION_KEY = 'hospitalityMicrophones';

const HOSPITALITY_ROLE_LABELS: Record<HospitalityRoleKey, string> = {
  chairman: 'Presidente',
  microphoneOne: 'Microfono 1',
  microphoneTwo: 'Microfono 2',
  microphoneThree: 'Microfono 3',
  attendantDoor: 'Acomodador de puerta',
  attendantAuditorium: 'Acomodador de auditorio',
  attendantExtra: 'Acomodador extra',
  watchtowerReader: 'Lector del Estudio de la Atalaya',
  midweekBibleStudyReader: 'Lector del Estudio Biblico',
  audioVideo: 'Audio y video',
};

// Orden de aparicion en la seccion de la reunion: el presidente siempre va primero.
const HOSPITALITY_ROLE_ORDER: Record<HospitalityRoleKey, number> = {
  chairman: 0,
  microphoneOne: 1,
  microphoneTwo: 2,
  microphoneThree: 3,
  attendantDoor: 4,
  attendantAuditorium: 5,
  attendantExtra: 6,
  audioVideo: 7,
  watchtowerReader: 8,
  midweekBibleStudyReader: 8,
};

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeComparableText = (value: unknown): string =>
  (normalizeText(value) ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const parsePayload = (raw: unknown): { congregationId: string; scheduleId: string; syncMeetings: boolean } => {
  const data = raw as PublishSchedulePayload;
  const congregationId = normalizeText(data?.congregationId);
  const scheduleId = normalizeText(data?.scheduleId);

  if (!congregationId || !scheduleId) {
    throw new HttpsError('invalid-argument', 'congregationId y scheduleId son obligatorios.');
  }

  return {
    congregationId,
    scheduleId,
    syncMeetings: data.syncMeetings === true,
  };
};

const parseSubstitutePayload = (
  raw: unknown
): { congregationId: string; scheduleId: string; itemId: string; newUserId: string } => {
  const data = raw as SubstituteHospitalityAssignmentPayload;
  const congregationId = normalizeText(data?.congregationId);
  const scheduleId = normalizeText(data?.scheduleId);
  const itemId = normalizeText(data?.itemId);
  const newUserId = normalizeText(data?.newUserId);

  if (!congregationId || !scheduleId || !itemId || !newUserId) {
    throw new HttpsError(
      'invalid-argument',
      'congregationId, scheduleId, itemId y newUserId son obligatorios.'
    );
  }

  return { congregationId, scheduleId, itemId, newUserId };
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? value as Record<string, unknown> : null;

const normalizeRole = (value: unknown): UserRole | undefined => {
  if (value === 'admin' || value === 'supervisor' || value === 'user') return value;
  if (value === 'administrador') return 'admin';
  if (value === 'usuario') return 'user';
  return undefined;
};

const resolveIsActive = (data: Record<string, unknown>): boolean => {
  if (typeof data.isActive === 'boolean') return data.isActive;
  if (data.status === 'active') return true;
  return false;
};

const toServiceAssignments = (value: unknown): { position?: string; department?: string }[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => ({
      position: normalizeText(item.position),
      department: normalizeText(item.department),
    }));
};

const getRequesterProfile = async (uid: string): Promise<RequesterProfile> => {
  const snap = await adminDb.collection('users').doc(uid).get();

  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'No existe perfil del usuario autenticado.');
  }

  const data = snap.data() as Record<string, unknown>;
  const role = normalizeRole(data.role) ?? 'user';
  const congregationId = normalizeText(data.congregationId);

  if (!congregationId || !resolveIsActive(data)) {
    throw new HttpsError('permission-denied', 'Perfil de usuario invalido o inactivo.');
  }

  return {
    role,
    isActive: true,
    congregationId,
    displayName: normalizeText(data.displayName),
    email: normalizeText(data.email),
    servicePosition: normalizeText(data.servicePosition),
    serviceDepartment: normalizeText(data.serviceDepartment),
    serviceAssignments: toServiceAssignments(data.serviceAssignments),
    permissions: asRecord(data.permissions) as RequesterProfile['permissions'],
  };
};

const hasServiceAssignment = (
  requester: RequesterProfile,
  position: string,
  department: string
): boolean =>
  (
    requester.servicePosition === position &&
    requester.serviceDepartment === department
  ) ||
  requester.serviceAssignments?.some(
    (assignment) => assignment.position === position && assignment.department === department
  ) === true;

const hasPermission = (
  requester: RequesterProfile,
  department: string,
  action: string
): boolean => {
  const permissions = requester.permissions?.[department];
  return permissions?.[action] === true || (action !== 'manage' && permissions?.manage === true);
};

const assertCleaningManager = (requester: RequesterProfile, congregationId: string): void => {
  if (requester.congregationId !== congregationId) {
    throw new HttpsError('permission-denied', 'No puedes gestionar otra congregacion.');
  }

  if (
    requester.role !== 'admin' &&
    !hasPermission(requester, 'limpieza', 'manage') &&
    !(hasPermission(requester, 'limpieza', 'create') && hasPermission(requester, 'limpieza', 'edit')) &&
    !hasServiceAssignment(requester, 'encargado', 'limpieza')
  ) {
    throw new HttpsError('permission-denied', 'No tienes permisos para publicar limpieza.');
  }
};

const assertHospitalityManager = (requester: RequesterProfile, congregationId: string): void => {
  if (requester.congregationId !== congregationId) {
    throw new HttpsError('permission-denied', 'No puedes gestionar otra congregacion.');
  }

  if (
    requester.role !== 'admin' &&
    !hasPermission(requester, 'acomodadores_microfonos', 'manage') &&
    !(hasPermission(requester, 'acomodadores_microfonos', 'create') && hasPermission(requester, 'acomodadores_microfonos', 'edit')) &&
    !hasServiceAssignment(requester, 'encargado', 'acomodadores_microfonos') &&
    !hasServiceAssignment(requester, 'auxiliar', 'acomodadores_microfonos')
  ) {
    throw new HttpsError('permission-denied', 'No tienes permisos para publicar acomodadores y microfonos.');
  }
};

const parseDateKey = (value: string): Date | null => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, yearRaw, monthRaw, dayRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const parsed = new Date(year, month - 1, day);
  parsed.setHours(0, 0, 0, 0);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};

const dayRange = (dateKey: string): { start: Timestamp; end: Timestamp } => {
  const start = parseDateKey(dateKey);
  if (!start) {
    throw new HttpsError('invalid-argument', 'Fecha de schedule invalida.');
  }

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return {
    start: Timestamp.fromDate(start),
    end: Timestamp.fromDate(end),
  };
};

const MAX_PLANNING_DAYS = 62;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const formatDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

const parsePlanningDay = (value: unknown, fieldName: string): number => {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 6) {
    throw new HttpsError('invalid-argument', `${fieldName} debe ser un entero entre 0 y 6.`);
  }
  return value as number;
};

const parseEnsurePlanningMeetingsPayload = (
  raw: unknown
): {
  congregationId: string;
  startDate: Date;
  endDate: Date;
  midweekDay: number;
  weekendDay: number;
} => {
  const data = raw as EnsurePlanningMeetingsPayload;
  const congregationId = normalizeText(data?.congregationId);
  const startDateKey = normalizeText(data?.startDate);
  const endDateKey = normalizeText(data?.endDate);

  if (!congregationId || !startDateKey || !endDateKey) {
    throw new HttpsError(
      'invalid-argument',
      'congregationId, startDate y endDate son obligatorios.'
    );
  }

  const startDate = parseDateKey(startDateKey);
  const endDate = parseDateKey(endDateKey);
  if (!startDate || !endDate || startDate > endDate) {
    throw new HttpsError('invalid-argument', 'El rango de fechas no es valido.');
  }

  const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;
  if (totalDays > MAX_PLANNING_DAYS) {
    throw new HttpsError(
      'invalid-argument',
      `La lista no puede cubrir mas de ${MAX_PLANNING_DAYS} dias.`
    );
  }

  const monthIds = new Set<string>();
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    monthIds.add(formatDateKey(cursor).slice(0, 7));
    cursor.setDate(cursor.getDate() + 1);
  }
  if (monthIds.size > 2) {
    throw new HttpsError(
      'invalid-argument',
      'La lista no puede cubrir mas de dos meses calendario.'
    );
  }

  return {
    congregationId,
    startDate,
    endDate,
    midweekDay: parsePlanningDay(data.midweekDay, 'midweekDay'),
    weekendDay: parsePlanningDay(data.weekendDay, 'weekendDay'),
  };
};

const rangesOverlap = (
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string
): boolean => leftStart <= rightEnd && rightStart <= leftEnd;

const assertNoPublishedOverlap = async (params: {
  congregationId: string;
  collectionName: 'cleaningSchedules' | 'hospitalitySchedules';
  scheduleId: string;
  startDate: string;
  endDate: string;
}): Promise<void> => {
  const snap = await adminDb
    .collection('congregations')
    .doc(params.congregationId)
    .collection(params.collectionName)
    .where('status', '==', 'published')
    .get();

  const conflict = snap.docs.find((doc) => {
    if (doc.id === params.scheduleId) return false;
    const data = doc.data() as Record<string, unknown>;
    const startDate = normalizeText(data.startDate);
    const endDate = normalizeText(data.endDate);
    return Boolean(startDate && endDate && rangesOverlap(params.startDate, params.endDate, startDate, endDate));
  });

  if (conflict) {
    throw new HttpsError('already-exists', 'Ya existe una lista publicada que se traslapa con ese rango.');
  }
};

const getScheduleForPublish = async (params: {
  congregationId: string;
  collectionName: 'cleaningSchedules' | 'hospitalitySchedules';
  scheduleId: string;
}): Promise<Record<string, unknown>> => {
  const ref = adminDb
    .collection('congregations')
    .doc(params.congregationId)
    .collection(params.collectionName)
    .doc(params.scheduleId);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new HttpsError('not-found', 'Lista no encontrada.');
  }

  const data = snap.data() as Record<string, unknown>;
  if (normalizeText(data.congregationId) !== params.congregationId) {
    throw new HttpsError('permission-denied', 'La lista no pertenece a esta congregacion.');
  }

  const startDate = normalizeText(data.startDate);
  const endDate = normalizeText(data.endDate);
  if (!startDate || !endDate) {
    throw new HttpsError('failed-precondition', 'La lista no tiene rango valido.');
  }

  await assertNoPublishedOverlap({
    congregationId: params.congregationId,
    collectionName: params.collectionName,
    scheduleId: params.scheduleId,
    startDate,
    endDate,
  });

  return data;
};

const publishSchedule = async (params: {
  congregationId: string;
  collectionName: 'cleaningSchedules' | 'hospitalitySchedules';
  scheduleId: string;
  requesterUid: string;
  scheduleData?: Record<string, unknown>;
}): Promise<Record<string, unknown>> => {
  const data = params.scheduleData ?? await getScheduleForPublish(params);
  await adminDb
    .collection('congregations')
    .doc(params.congregationId)
    .collection(params.collectionName)
    .doc(params.scheduleId)
    .update({
      status: 'published',
      updatedBy: params.requesterUid,
      updatedAt: FieldValue.serverTimestamp(),
      publishedAt: FieldValue.serverTimestamp(),
    });

  return data;
};

const toMeetingKind = (value: unknown): 'midweek' | 'weekend' =>
  value === 'midweek' ? 'midweek' : 'weekend';

const syncCleaningScheduleToMeetings = async (params: {
  congregationId: string;
  scheduleId: string;
  requesterUid: string;
  requesterName: string;
}): Promise<{ syncedMeetings: number; missingMeetings: number }> => {
  const itemsSnap = await adminDb
    .collection('congregations')
    .doc(params.congregationId)
    .collection('cleaningSchedules')
    .doc(params.scheduleId)
    .collection('items')
    .where('status', '==', 'scheduled')
    .get();

  let syncedMeetings = 0;
  let missingMeetings = 0;

  for (const itemDoc of itemsSnap.docs) {
    const item = itemDoc.data() as Record<string, unknown>;
    const meetingDate = normalizeText(item.meetingDate);
    const cleaningGroupId = normalizeText(item.cleaningGroupId);
    const cleaningGroupName = normalizeText(item.cleaningGroupName);

    if (!meetingDate || !cleaningGroupId || !cleaningGroupName) {
      continue;
    }

    const range = dayRange(meetingDate);
    const meetingType = toMeetingKind(item.meetingType);
    const meetingsSnap = await adminDb
      .collection('congregations')
      .doc(params.congregationId)
      .collection('meetings')
      .where('meetingDate', '>=', range.start)
      .where('meetingDate', '<=', range.end)
      .limit(10)
      .get();
    const meetingDoc = meetingsSnap.docs.find((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const category = normalizeText(data.meetingCategory);
      const type = normalizeText(data.type);
      return meetingType === 'midweek'
        ? category === 'midweek' || type === 'midweek'
        : category === 'weekend' || type !== 'midweek';
    });

    if (!meetingDoc) {
      missingMeetings += 1;
      continue;
    }

    const meetingRef = meetingDoc.ref;
    const meetingData = meetingDoc.data() as Record<string, unknown>;
    const meetingTitle = normalizeText(meetingData.title) ?? 'Reunion';
    const assignmentsRef = meetingRef.collection('assignments');
    const assignmentId = `cleaning-${cleaningGroupId}`;
    const batch = adminDb.batch();

    batch.set(
      assignmentsRef.doc(assignmentId),
      {
        congregationId: params.congregationId,
        meetingId: meetingDoc.id,
        source: 'meeting-cleaning',
        category: 'cleaning',
        type: 'cleaning',
        title: `Limpieza - ${cleaningGroupName}`,
        description: meetingTitle,
        notes: meetingTitle,
        priority: 'medium',
        cleaningGroupId,
        cleaningGroupName,
        assignedToUid: cleaningGroupId,
        assignedToName: cleaningGroupName,
        assignedByUid: params.requesterUid,
        assignedByName: params.requesterName,
        createdBy: params.requesterUid,
        updatedBy: params.requesterUid,
        dueDate: range.start,
        date: range.start,
        status: 'pending',
        assignedUsers: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    batch.update(meetingRef, {
      cleaningAssignmentMode: 'selected',
      cleaningGroupIds: [cleaningGroupId],
      cleaningGroupNames: [cleaningGroupName],
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: params.requesterUid,
    });

    await batch.commit();
    syncedMeetings += 1;
  }

  return { syncedMeetings, missingMeetings };
};

const isHospitalityRoleKey = (value: unknown): value is HospitalityRoleKey =>
  value === 'chairman' ||
  value === 'microphoneOne' ||
  value === 'microphoneTwo' ||
  value === 'microphoneThree' ||
  value === 'attendantDoor' ||
  value === 'attendantAuditorium' ||
  value === 'attendantExtra' ||
  value === 'watchtowerReader' ||
  value === 'midweekBibleStudyReader' ||
  value === 'audioVideo';

const normalizeHospitalityItem = (value: FirestoreRecord): HospitalityScheduleItem | null => {
  const meetingDate = normalizeText(value.meetingDate);
  const meetingType = value.meetingType === 'midweek' ? 'midweek' : value.meetingType === 'weekend' ? 'weekend' : undefined;
  const roleKey = isHospitalityRoleKey(value.roleKey) ? value.roleKey : undefined;
  const userId = normalizeText(value.userId);
  const userNameSnapshot = normalizeText(value.userNameSnapshot);

  if (!meetingDate || !meetingType || !roleKey || !userId || !userNameSnapshot) {
    return null;
  }

  return {
    meetingDate,
    meetingType,
    roleKey,
    roleLabel: normalizeText(value.roleLabel) ?? HOSPITALITY_ROLE_LABELS[roleKey],
    userId,
    userNameSnapshot,
  };
};

const getWeekStartDateKey = (dateKey: string): string => {
  const date = parseDateKey(dateKey);
  if (!date) throw new HttpsError('failed-precondition', 'La fecha de reunion no es valida.');
  const shift = date.getDay() === 0 ? -6 : 1 - date.getDay();
  date.setDate(date.getDate() + shift);
  return formatDateKey(date);
};

const getWeekEndDateKey = (weekStartDate: string): string => {
  const date = parseDateKey(weekStartDate);
  if (!date) throw new HttpsError('failed-precondition', 'La semana de salida no es valida.');
  date.setDate(date.getDate() + 6);
  return formatDateKey(date);
};

const assertNoHospitalityOutgoingTalkConflicts = async (params: {
  congregationId: string;
  scheduleId: string;
  scheduleData: Record<string, unknown>;
}): Promise<void> => {
  const startDate = normalizeText(params.scheduleData.startDate);
  const endDate = normalizeText(params.scheduleData.endDate);
  if (!startDate || !endDate) {
    throw new HttpsError('failed-precondition', 'La lista no tiene rango valido.');
  }

  const startWeek = getWeekStartDateKey(startDate);
  const endWeek = getWeekStartDateKey(endDate);
  const [itemsSnap, outgoingSnap] = await Promise.all([
    adminDb
      .collection('congregations')
      .doc(params.congregationId)
      .collection('hospitalitySchedules')
      .doc(params.scheduleId)
      .collection('items')
      .where('status', '==', 'scheduled')
      .get(),
    adminDb
      .collection('congregations')
      .doc(params.congregationId)
      .collection('outgoingTalks')
      .where('status', '==', 'scheduled')
      .where('weekStartDate', '>=', startWeek)
      .where('weekStartDate', '<=', endWeek)
      .get(),
  ]);

  const outgoingTalks = outgoingSnap.docs.map((docSnap) => docSnap.data() as FirestoreRecord);
  for (const itemDoc of itemsSnap.docs) {
    const item = normalizeHospitalityItem(itemDoc.data() as FirestoreRecord);
    if (!item || item.meetingType !== 'weekend') continue;

    const conflict = outgoingTalks.find((talk) => {
      const weekStartDate = normalizeText(talk.weekStartDate);
      return normalizeText(talk.speakerUserId) === item.userId &&
        Boolean(
          weekStartDate &&
          item.meetingDate >= weekStartDate &&
          item.meetingDate <= getWeekEndDateKey(weekStartDate)
        );
    });
    if (!conflict) continue;

    const name = normalizeText(conflict.speakerName) ?? item.userNameSnapshot;
    const date = normalizeText(conflict.talkDate) ?? item.meetingDate;
    throw new HttpsError(
      'failed-precondition',
      `${name} no puede tener asignaciones el fin de semana: sale a discursar esa semana (${date}).`
    );
  }
};

// Version acotada a un solo usuario/fecha de assertNoHospitalityOutgoingTalkConflicts,
// usada por la sustitucion puntual (AM-4) en vez de recorrer todo el rango de la lista.
// Reutiliza la misma forma de query (status + rango de weekStartDate) para no requerir
// un indice compuesto nuevo.
const assertNoSingleHospitalitySubstitutionConflict = async (params: {
  congregationId: string;
  meetingDate: string;
  newUserId: string;
  newUserName: string;
}): Promise<void> => {
  const weekStart = getWeekStartDateKey(params.meetingDate);
  const outgoingSnap = await adminDb
    .collection('congregations')
    .doc(params.congregationId)
    .collection('outgoingTalks')
    .where('status', '==', 'scheduled')
    .where('weekStartDate', '>=', weekStart)
    .where('weekStartDate', '<=', weekStart)
    .get();

  const conflict = outgoingSnap.docs
    .map((docSnap) => docSnap.data() as FirestoreRecord)
    .find((talk) => normalizeText(talk.speakerUserId) === params.newUserId);

  if (!conflict) return;

  const date = normalizeText(conflict.talkDate) ?? params.meetingDate;
  throw new HttpsError(
    'failed-precondition',
    `${params.newUserName} no puede tener asignaciones el fin de semana: sale a discursar esa semana (${date}).`
  );
};

// Espejo del backend de isEligibleForHospitalityRole
// (src/modules/assignments/utils/hospitality-eligibility.ts). Todos los roles de
// hospitalidad exigen anciano o siervo ministerial; si eso cambia, actualizar ambos.
const isHospitalityEligible = (data: Record<string, unknown>): boolean => {
  const privileges = asRecord(data.privileges);
  const isElder = data.isElder === true || privileges?.isElder === true;
  const isMinisterialServant =
    data.isMinisterialServant === true || privileges?.isMinisterialServant === true;
  return isElder || isMinisterialServant;
};

const assertHospitalityRoleEligibility = async (params: {
  congregationId: string;
  scheduleId: string;
}): Promise<void> => {
  const itemsSnap = await adminDb
    .collection('congregations')
    .doc(params.congregationId)
    .collection('hospitalitySchedules')
    .doc(params.scheduleId)
    .collection('items')
    .where('status', '==', 'scheduled')
    .get();

  const items = itemsSnap.docs
    .map((itemDoc) => normalizeHospitalityItem(itemDoc.data() as FirestoreRecord))
    .filter((item): item is HospitalityScheduleItem => item !== null);

  const userIds = Array.from(new Set(items.map((item) => item.userId)));
  const userSnaps = await Promise.all(
    userIds.map((userId) => adminDb.collection('users').doc(userId).get())
  );
  const usersById = new Map(
    userSnaps
      .filter((snap) => snap.exists)
      .map((snap) => [snap.id, snap.data() as FirestoreRecord])
  );

  for (const item of items) {
    const userData = usersById.get(item.userId);
    if (!userData || !isHospitalityEligible(userData)) {
      throw new HttpsError(
        'failed-precondition',
        `${item.userNameSnapshot} no es anciano ni siervo ministerial: no puede cumplir ${item.roleLabel} (${item.meetingDate}).`
      );
    }
  }
};

export const isReaderRole = (roleKey: HospitalityRoleKey): boolean =>
  roleKey === 'watchtowerReader' || roleKey === 'midweekBibleStudyReader';

const createHospitalityAssignee = (item: HospitalityScheduleItem): FirestoreRecord => ({
  id: `${item.roleKey}-${item.userId}`,
  assigneeType: 'registeredUser',
  assigneeUserId: item.userId,
  assigneeNameSnapshot: item.userNameSnapshot,
});

const markHospitalityAssignment = (assignment: FirestoreRecord): FirestoreRecord => ({
  ...assignment,
  controlledBy: 'hospitalityMicrophones',
  lockedFromMeetingEditor: true,
  sourceModule: 'hospitalityMicrophones',
});

const createHospitalityAssignment = (item: HospitalityScheduleItem): FirestoreRecord =>
  markHospitalityAssignment({
    assignmentKey: `${HOSPITALITY_SECTION_KEY}-${item.roleKey}`,
    sectionKey: HOSPITALITY_SECTION_KEY,
    title: HOSPITALITY_ROLE_LABELS[item.roleKey] ?? item.roleLabel,
    roleLabel: item.roleLabel || HOSPITALITY_ROLE_LABELS[item.roleKey],
    assignmentScope: 'internal',
    assignees: [createHospitalityAssignee(item)],
  });

export const isControlledReaderAssignment = (sectionKey: string, assignment: FirestoreRecord): boolean => {
  const roleLabel = normalizeComparableText(assignment.roleLabel);
  const title = normalizeComparableText(assignment.title);

  if (sectionKey === 'livingAsChristians') {
    return roleLabel === 'lector' && title === 'lector';
  }

  if (sectionKey.startsWith('weekendAssignments')) {
    return roleLabel === 'lector' && title.includes('lector del estudio');
  }

  return false;
};

const withSectionOrder = (sections: FirestoreRecord[]): FirestoreRecord[] =>
  sections.map((section, index) => ({ ...section, order: index }));

const getSectionAssignments = (section: FirestoreRecord): FirestoreRecord[] =>
  Array.isArray(section.assignments)
    ? section.assignments.filter((item): item is FirestoreRecord => item !== null && typeof item === 'object')
    : [];

export const applyReaderItemsToSections = (
  sections: FirestoreRecord[],
  items: HospitalityScheduleItem[],
  meetingType: HospitalityMeetingType
): { sections: FirestoreRecord[]; placed: boolean } => {
  const targetRole =
    meetingType === 'midweek' ? 'midweekBibleStudyReader' : 'watchtowerReader';
  const item = items.find((candidate) => candidate.roleKey === targetRole);
  if (!item) return { sections, placed: false };

  let placed = false;
  const nextSections = sections.map((section) => {
    const sectionKey = normalizeText(section.sectionKey) ?? '';
    return {
      ...section,
      assignments: getSectionAssignments(section).map((assignment) => {
        if (!isControlledReaderAssignment(sectionKey, assignment)) {
          return assignment;
        }

        placed = true;
        const existingAssignee = Array.isArray(assignment.assignees)
          ? assignment.assignees.find((assignee) => assignee && typeof assignee === 'object') as FirestoreRecord | undefined
          : undefined;

        return markHospitalityAssignment({
          ...assignment,
          assignees: [
            {
              ...createHospitalityAssignee(item),
              publishNotificationSentAt: existingAssignee?.publishNotificationSentAt,
              reminderSentAt: existingAssignee?.reminderSentAt,
            },
          ],
        });
      }),
    };
  });

  return { sections: nextSections, placed };
};

export const upsertHospitalitySection = (
  sections: FirestoreRecord[],
  items: HospitalityScheduleItem[],
  includeReaders: boolean
): FirestoreRecord[] => {
  const sectionItems = includeReaders ? items : items.filter((item) => !isReaderRole(item.roleKey));
  if (sectionItems.length === 0) return sections;

  const existingIndex = sections.findIndex((section) => section.sectionKey === HOSPITALITY_SECTION_KEY);
  const existingSection = existingIndex >= 0 ? sections[existingIndex] : undefined;
  const controlledKeys = new Set(
    sectionItems.map((item) => `${HOSPITALITY_SECTION_KEY}-${item.roleKey}`)
  );
  const existingAssignments = existingSection
    ? getSectionAssignments(existingSection).filter(
        (assignment) => !controlledKeys.has(normalizeText(assignment.assignmentKey) ?? '')
      )
    : [];
  const orderedSectionItems = [...sectionItems].sort(
    (left, right) => HOSPITALITY_ROLE_ORDER[left.roleKey] - HOSPITALITY_ROLE_ORDER[right.roleKey]
  );
  const controlledAssignments = orderedSectionItems.map((item) => createHospitalityAssignment(item));
  const nextSection: FirestoreRecord = {
    ...(existingSection ?? {}),
    sectionKey: HOSPITALITY_SECTION_KEY,
    title: 'Micrófonos, Acomodadores y Lectores',
    order:
      typeof existingSection?.order === 'number' && Number.isFinite(existingSection.order)
        ? existingSection.order
        : sections.length,
    sectionType: 'dynamic',
    isRequired: false,
    isEnabled: true,
    colorToken: 'teal',
    assignments: [...existingAssignments, ...controlledAssignments],
  };

  if (existingIndex < 0) {
    return withSectionOrder([...sections, nextSection]);
  }

  return withSectionOrder(
    sections.map((section, index) => (index === existingIndex ? nextSection : section))
  );
};

export const collectAssignedUserIdsFromSections = (sections: FirestoreRecord[]): string[] => {
  const ids = new Set<string>();

  sections.forEach((section) => {
    if (section.isEnabled === false) return;

    getSectionAssignments(section).forEach((assignment) => {
      if (assignment.assignmentScope !== 'internal') return;

      const assignees = Array.isArray(assignment.assignees) ? assignment.assignees : [];
      assignees.forEach((rawAssignee) => {
        if (!rawAssignee || typeof rawAssignee !== 'object') return;
        const assignee = rawAssignee as FirestoreRecord;
        if (assignee.assigneeType !== 'registeredUser') return;
        const userId = normalizeText(assignee.assigneeUserId);
        if (userId) ids.add(userId);
      });
    });
  });

  return Array.from(ids);
};

const getMeetingSections = (meetingData: FirestoreRecord): FirestoreRecord[] => {
  const rawSections = Array.isArray(meetingData.sections)
    ? meetingData.sections
    : Array.isArray(meetingData.midweekSections)
      ? meetingData.midweekSections
      : [];

  return rawSections
    .filter((section): section is FirestoreRecord => section !== null && typeof section === 'object')
    .sort((left, right) => {
      const leftOrder = typeof left.order === 'number' && Number.isFinite(left.order) ? left.order : 0;
      const rightOrder = typeof right.order === 'number' && Number.isFinite(right.order) ? right.order : 0;
      return leftOrder - rightOrder;
    })
    .map((section, index) => ({ ...section, order: index }));
};

export const applyHospitalityItemsToMeetingSections = (
  meetingData: FirestoreRecord,
  items: HospitalityScheduleItem[],
  meetingType: HospitalityMeetingType
): FirestoreRecord[] => {
  let sections = getMeetingSections(meetingData);
  const reader = applyReaderItemsToSections(sections, items, meetingType);
  sections = reader.sections;
  sections = upsertHospitalitySection(sections, items, !reader.placed);
  return sections;
};

const groupHospitalityItemsByMeeting = (
  items: HospitalityScheduleItem[]
): Map<string, HospitalityScheduleItem[]> => {
  const grouped = new Map<string, HospitalityScheduleItem[]>();

  items.forEach((item) => {
    const key = `${item.meetingDate}::${item.meetingType}`;
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  });

  return grouped;
};

const findMeetingForDateAndType = async (params: {
  congregationId: string;
  meetingDate: string;
  meetingType: HospitalityMeetingType;
}) => {
  const range = dayRange(params.meetingDate);
  const meetingsSnap = await adminDb
    .collection('congregations')
    .doc(params.congregationId)
    .collection('meetings')
    .where('meetingDate', '>=', range.start)
    .where('meetingDate', '<=', range.end)
    .limit(10)
    .get();

  return meetingsSnap.docs.find((doc) => {
    const data = doc.data() as FirestoreRecord;
    const category = normalizeText(data.meetingCategory);
    const type = normalizeText(data.type);
    return params.meetingType === 'midweek'
      ? category === 'midweek' || type === 'midweek'
      : category === 'weekend' || type !== 'midweek';
  });
};

// Sincroniza una unica reunion a partir de los items de hospitalidad ya resueltos
// para esa fecha/tipo. Compartido entre la sincronizacion masiva al publicar y la
// sustitucion puntual de una asignacion (AM-4), para no duplicar la logica de merge
// de secciones. Si se pasa `batch`, la escritura se agrega al batch en vez de aplicarse
// de inmediato, permitiendo agruparla atomicamente con otras escrituras del llamador.
const syncSingleMeetingFromItems = async (params: {
  congregationId: string;
  meetingDate: string;
  meetingType: HospitalityMeetingType;
  items: HospitalityScheduleItem[];
  requesterUid: string;
  batch?: WriteBatch;
}): Promise<{ synced: boolean }> => {
  const meetingDoc = await findMeetingForDateAndType({
    congregationId: params.congregationId,
    meetingDate: params.meetingDate,
    meetingType: params.meetingType,
  });

  if (!meetingDoc) {
    return { synced: false };
  }

  const meetingData = meetingDoc.data() as FirestoreRecord;
  const sections = applyHospitalityItemsToMeetingSections(
    meetingData,
    params.items,
    params.meetingType
  );

  // Compatibilidad con esqueletos creados por versiones anteriores. El planificador
  // ya no publica reuniones: solo actualiza sus asignaciones y las devuelve a revision.
  const isPlanningSkeleton =
    normalizeText(meetingData.origin) === 'hospitalityPlanning' ||
    meetingDoc.id.startsWith('planning-');

  const updatePayload: FirestoreRecord = {
    sections,
    assignedUserIds: collectAssignedUserIdsFromSections(sections),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: params.requesterUid,
  };

  if (isPlanningSkeleton) {
    updatePayload.publicationStatus = 'awaiting_assignments';
  }

  if (params.batch) {
    params.batch.update(meetingDoc.ref, updatePayload);
  } else {
    await meetingDoc.ref.update(updatePayload);
  }

  return { synced: true };
};

const syncHospitalityScheduleToMeetings = async (params: {
  congregationId: string;
  scheduleId: string;
  requesterUid: string;
}): Promise<{ syncedMeetings: number; missingMeetings: number }> => {
  const itemsSnap = await adminDb
    .collection('congregations')
    .doc(params.congregationId)
    .collection('hospitalitySchedules')
    .doc(params.scheduleId)
    .collection('items')
    .where('status', '==', 'scheduled')
    .get();

  const items = itemsSnap.docs
    .map((itemDoc) => normalizeHospitalityItem(itemDoc.data() as FirestoreRecord))
    .filter((item): item is HospitalityScheduleItem => item !== null);
  const grouped = groupHospitalityItemsByMeeting(items);
  let syncedMeetings = 0;
  let missingMeetings = 0;

  for (const groupedItems of grouped.values()) {
    const firstItem = groupedItems[0];
    const result = await syncSingleMeetingFromItems({
      congregationId: params.congregationId,
      meetingDate: firstItem.meetingDate,
      meetingType: firstItem.meetingType,
      items: groupedItems,
      requesterUid: params.requesterUid,
    });

    if (result.synced) syncedMeetings += 1;
    else missingMeetings += 1;
  }

  return { syncedMeetings, missingMeetings };
};

export const ensurePlanningMeetingsByManager = onCall(
  { region: 'us-central1' },
  async (request): Promise<EnsurePlanningMeetingsResult> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const rawData = request.data as EnsurePlanningMeetingsPayload;
    const congregationId = normalizeText(rawData?.congregationId);
    if (!congregationId) {
      throw new HttpsError('invalid-argument', 'congregationId es obligatorio.');
    }

    const requester = await getRequesterProfile(request.auth.uid);
    assertHospitalityManager(requester, congregationId);
    const payload = parseEnsurePlanningMeetingsPayload(request.data);
    const createdMidweek = 0;
    const createdWeekend = 0;
    let existing = 0;

    const candidates: { dateKey: string; meetingType: HospitalityMeetingType }[] = [];
    const cursor = new Date(payload.startDate);
    while (cursor <= payload.endDate) {
      const dateKey = formatDateKey(cursor);
      if (cursor.getDay() === payload.midweekDay) {
        candidates.push({ dateKey, meetingType: 'midweek' });
      }
      if (cursor.getDay() === payload.weekendDay) {
        candidates.push({ dateKey, meetingType: 'weekend' });
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    for (const candidate of candidates) {
      const existingMeeting = await findMeetingForDateAndType({
        congregationId: payload.congregationId,
        meetingDate: candidate.dateKey,
        meetingType: candidate.meetingType,
      });
      if (existingMeeting) {
        existing += 1;
        continue;
      }

    }

    return { ok: true, createdMidweek, createdWeekend, existing };
  }
);

export const publishCleaningScheduleByManager = onCall(
  { region: 'us-central1' },
  async (request): Promise<{ ok: true; syncedMeetings: number; missingMeetings: number }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = parsePayload(request.data);
    const requester = await getRequesterProfile(request.auth.uid);
    assertCleaningManager(requester, payload.congregationId);

    await publishSchedule({
      congregationId: payload.congregationId,
      collectionName: 'cleaningSchedules',
      scheduleId: payload.scheduleId,
      requesterUid: request.auth.uid,
    });

    const syncResult = payload.syncMeetings
      ? await syncCleaningScheduleToMeetings({
          congregationId: payload.congregationId,
          scheduleId: payload.scheduleId,
          requesterUid: request.auth.uid,
          requesterName: requester.displayName ?? requester.email ?? 'Usuario',
        })
      : { syncedMeetings: 0, missingMeetings: 0 };

    return { ok: true, ...syncResult };
  }
);

export const publishHospitalityScheduleByManager = onCall(
  { region: 'us-central1' },
  async (request): Promise<{ ok: true; syncedMeetings: number; missingMeetings: number }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = parsePayload(request.data);
    const requester = await getRequesterProfile(request.auth.uid);
    assertHospitalityManager(requester, payload.congregationId);

    const scheduleData = await getScheduleForPublish({
      congregationId: payload.congregationId,
      collectionName: 'hospitalitySchedules',
      scheduleId: payload.scheduleId,
    });
    await assertNoHospitalityOutgoingTalkConflicts({
      congregationId: payload.congregationId,
      scheduleId: payload.scheduleId,
      scheduleData,
    });
    await assertHospitalityRoleEligibility({
      congregationId: payload.congregationId,
      scheduleId: payload.scheduleId,
    });
    await publishSchedule({
      congregationId: payload.congregationId,
      collectionName: 'hospitalitySchedules',
      scheduleId: payload.scheduleId,
      requesterUid: request.auth.uid,
      scheduleData,
    });

    const syncResult = payload.syncMeetings
      ? await syncHospitalityScheduleToMeetings({
          congregationId: payload.congregationId,
          scheduleId: payload.scheduleId,
          requesterUid: request.auth.uid,
        })
      : { syncedMeetings: 0, missingMeetings: 0 };

    return { ok: true, ...syncResult };
  }
);

// Unica puerta de cambio para asignaciones de una lista de hospitalidad ya publicada:
// valida al sustituto, actualiza el item y re-sincroniza solo la reunion afectada en
// una escritura atomica (batch). El editor de reuniones sigue bloqueado para estos roles.
export const substituteHospitalityAssignmentByManager = onCall(
  { region: 'us-central1' },
  async (request): Promise<{ ok: true; meetingSynced: boolean }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = parseSubstitutePayload(request.data);
    const requester = await getRequesterProfile(request.auth.uid);
    assertHospitalityManager(requester, payload.congregationId);

    const scheduleRef = adminDb
      .collection('congregations')
      .doc(payload.congregationId)
      .collection('hospitalitySchedules')
      .doc(payload.scheduleId);
    const scheduleSnap = await scheduleRef.get();

    if (!scheduleSnap.exists) {
      throw new HttpsError('not-found', 'Lista no encontrada.');
    }

    const scheduleData = scheduleSnap.data() as FirestoreRecord;
    if (normalizeText(scheduleData.congregationId) !== payload.congregationId) {
      throw new HttpsError('permission-denied', 'La lista no pertenece a esta congregacion.');
    }
    if (scheduleData.status !== 'published') {
      throw new HttpsError(
        'failed-precondition',
        'Solo se pueden sustituir asignaciones de listas publicadas.'
      );
    }

    const itemRef = scheduleRef.collection('items').doc(payload.itemId);
    const itemSnap = await itemRef.get();

    if (!itemSnap.exists) {
      throw new HttpsError('not-found', 'Asignacion no encontrada.');
    }

    const itemRaw = itemSnap.data() as FirestoreRecord;
    if (itemRaw.status !== 'scheduled') {
      throw new HttpsError('failed-precondition', 'Solo se pueden sustituir asignaciones activas.');
    }

    const item = normalizeHospitalityItem(itemRaw);
    if (!item) {
      throw new HttpsError('failed-precondition', 'La asignacion no tiene datos validos.');
    }

    const newUserSnap = await adminDb.collection('users').doc(payload.newUserId).get();
    if (!newUserSnap.exists) {
      throw new HttpsError('not-found', 'El usuario sustituto no existe.');
    }

    const newUserData = newUserSnap.data() as FirestoreRecord;
    if (normalizeText(newUserData.congregationId) !== payload.congregationId) {
      throw new HttpsError(
        'failed-precondition',
        'El usuario sustituto no pertenece a esta congregacion.'
      );
    }
    if (!resolveIsActive(newUserData)) {
      throw new HttpsError('failed-precondition', 'El usuario sustituto esta inactivo.');
    }
    if (!isHospitalityEligible(newUserData)) {
      throw new HttpsError(
        'failed-precondition',
        'El usuario sustituto no es anciano ni siervo ministerial.'
      );
    }

    const newUserName =
      normalizeText(newUserData.displayName) ?? normalizeText(newUserData.email) ?? 'Usuario';

    const siblingItemsSnap = await scheduleRef
      .collection('items')
      .where('meetingDate', '==', item.meetingDate)
      .where('meetingType', '==', item.meetingType)
      .where('status', '==', 'scheduled')
      .get();

    const siblingItems = siblingItemsSnap.docs
      .map((doc) => ({ id: doc.id, item: normalizeHospitalityItem(doc.data() as FirestoreRecord) }))
      .filter(
        (entry): entry is { id: string; item: HospitalityScheduleItem } => entry.item !== null
      );

    const duplicateRole = siblingItems.find(
      (entry) => entry.id !== payload.itemId && entry.item.userId === payload.newUserId
    );
    if (duplicateRole) {
      throw new HttpsError(
        'failed-precondition',
        `${newUserName} ya tiene una asignacion (${duplicateRole.item.roleLabel}) en esa reunion.`
      );
    }

    if (item.meetingType === 'weekend') {
      await assertNoSingleHospitalitySubstitutionConflict({
        congregationId: payload.congregationId,
        meetingDate: item.meetingDate,
        newUserId: payload.newUserId,
        newUserName,
      });
    }

    const batch = adminDb.batch();
    batch.update(itemRef, {
      userId: payload.newUserId,
      userNameSnapshot: newUserName,
      updatedBy: request.auth.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const updatedItems: HospitalityScheduleItem[] = siblingItems.map((entry) =>
      entry.id === payload.itemId
        ? { ...entry.item, userId: payload.newUserId, userNameSnapshot: newUserName }
        : entry.item
    );

    const syncResult = await syncSingleMeetingFromItems({
      congregationId: payload.congregationId,
      meetingDate: item.meetingDate,
      meetingType: item.meetingType,
      items: updatedItems,
      requesterUid: request.auth.uid,
      batch,
    });

    await batch.commit();

    return { ok: true, meetingSynced: syncResult.synced };
  }
);
