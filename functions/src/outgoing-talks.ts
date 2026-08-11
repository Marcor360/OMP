import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';

import { adminDb } from './config/firebaseAdmin.js';
import { createInternalNotification } from './modules/notifications/notification.firestore.js';
import { assertAdministrativeBillingAccess } from './users/authorization.js';

type UserRole = 'admin' | 'supervisor' | 'user';
type OutgoingTalkStatus = 'scheduled' | 'cancelled' | 'completed';

type RequesterProfile = {
  role: UserRole;
  isActive: boolean;
  congregationId: string;
  displayName?: string;
  email?: string;
  servicePosition?: string;
  serviceDepartment?: string;
  serviceAssignments?: { position?: string; department?: string; label?: string }[];
};

type OutgoingTalkPayload = {
  congregationId: string;
  outgoingTalkId?: string;
  speakerUserId: string;
  destinationCongregationName: string;
  talkDate: string;
  talkTime: string;
  notes?: string;
  status?: OutgoingTalkStatus;
};

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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

const formatDateKey = (value: Date): string =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

const getWeekRangeForDate = (dateKey: string): { weekStartDate: string; weekEndDate: string } => {
  const parsed = parseDateKey(dateKey);
  if (!parsed) {
    throw new HttpsError('invalid-argument', 'Fecha de discurso invalida.');
  }

  const start = new Date(parsed);
  const day = start.getDay();
  const shift = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + shift);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return {
    weekStartDate: formatDateKey(start),
    weekEndDate: formatDateKey(end),
  };
};

const isWeekendDate = (dateKey: string): boolean => {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return false;
  const day = parsed.getDay();
  return day === 0 || day === 6;
};

const isStatus = (value: unknown): value is OutgoingTalkStatus =>
  value === 'scheduled' || value === 'cancelled' || value === 'completed';

const parsePayload = (raw: unknown, requireId: boolean): OutgoingTalkPayload => {
  if (!raw || typeof raw !== 'object') {
    throw new HttpsError('invalid-argument', 'Payload invalido.');
  }

  const data = raw as Record<string, unknown>;
  const congregationId = normalizeText(data.congregationId);
  const outgoingTalkId = normalizeText(data.outgoingTalkId);
  const speakerUserId = normalizeText(data.speakerUserId);
  const destinationCongregationName = normalizeText(data.destinationCongregationName);
  const talkDate = normalizeText(data.talkDate);
  const talkTime = normalizeText(data.talkTime);
  const status = isStatus(data.status) ? data.status : 'scheduled';

  if (!congregationId || !speakerUserId || !destinationCongregationName || !talkDate || !talkTime) {
    throw new HttpsError('invalid-argument', 'Faltan datos obligatorios para registrar la salida.');
  }

  if (requireId && !outgoingTalkId) {
    throw new HttpsError('invalid-argument', 'outgoingTalkId es obligatorio.');
  }

  if (!isWeekendDate(talkDate)) {
    throw new HttpsError('failed-precondition', 'La fecha del discurso debe ser sabado o domingo.');
  }

  return {
    congregationId,
    outgoingTalkId,
    speakerUserId,
    destinationCongregationName,
    talkDate,
    talkTime,
    notes: normalizeText(data.notes),
    status,
  };
};

const resolveIsActive = (data: Record<string, unknown>): boolean => {
  if (typeof data.isActive === 'boolean') return data.isActive;
  if (data.status === 'active') return true;
  return false;
};

const getRequesterProfile = async (uid: string): Promise<RequesterProfile> => {
  const snap = await adminDb.collection('users').doc(uid).get();

  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'No existe perfil del usuario autenticado.');
  }

  const data = snap.data() as Record<string, unknown>;
  const role = data.role === 'admin' || data.role === 'supervisor' || data.role === 'user'
    ? data.role
    : 'user';
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
    serviceAssignments: Array.isArray(data.serviceAssignments)
      ? data.serviceAssignments as RequesterProfile['serviceAssignments']
      : [],
  };
};

const assertOutgoingTalkManager = (requester: RequesterProfile, congregationId: string) => {
  const isTalkManager =
    requester.servicePosition === 'encargado' &&
    requester.serviceDepartment === 'discursos';
  const isTalkManagerFromAssignments = requester.serviceAssignments?.some(
    (assignment) =>
      assignment.position === 'encargado' &&
      assignment.department === 'discursos'
  ) === true;

  if (requester.congregationId !== congregationId) {
    throw new HttpsError('permission-denied', 'No puedes gestionar salidas de otra congregacion.');
  }

  if (requester.role !== 'admin' && !isTalkManager && !isTalkManagerFromAssignments) {
    throw new HttpsError('permission-denied', 'No tienes permisos para gestionar salidas a discursar.');
  }
};

const resolveSpeaker = async (speakerUserId: string, congregationId: string) => {
  const snap = await adminDb.collection('users').doc(speakerUserId).get();

  if (!snap.exists) {
    throw new HttpsError('not-found', 'Hermano no encontrado.');
  }

  const data = snap.data() as Record<string, unknown>;
  const privileges = data.privileges as Record<string, unknown> | undefined;
  const isElder = typeof data.isElder === 'boolean' ? data.isElder : privileges?.isElder === true;
  const isMinisterialServant =
    typeof data.isMinisterialServant === 'boolean'
      ? data.isMinisterialServant
      : privileges?.isMinisterialServant === true;

  if (normalizeText(data.congregationId) !== congregationId) {
    throw new HttpsError('permission-denied', 'El discursante debe pertenecer a la congregacion actual.');
  }

  if (!resolveIsActive(data)) {
    throw new HttpsError('failed-precondition', 'El discursante debe estar activo.');
  }

  if (!isElder && !isMinisterialServant) {
    throw new HttpsError(
      'failed-precondition',
      'Solo ancianos y siervos ministeriales pueden salir a discursar.'
    );
  }

  return {
    uid: snap.id,
    displayName: normalizeText(data.displayName) ?? normalizeText(data.email) ?? snap.id,
  };
};

const assertNoDuplicateScheduledTalk = async (params: {
  congregationId: string;
  speakerUserId: string;
  weekStartDate: string;
  excludeOutgoingTalkId?: string;
}) => {
  const snapshot = await adminDb
    .collection('congregations')
    .doc(params.congregationId)
    .collection('outgoingTalks')
    .where('speakerUserId', '==', params.speakerUserId)
    .where('status', '==', 'scheduled')
    .where('weekStartDate', '==', params.weekStartDate)
    .limit(5)
    .get();

  const duplicate = snapshot.docs.find((doc) => doc.id !== params.excludeOutgoingTalkId);
  if (duplicate) {
    throw new HttpsError(
      'already-exists',
      'Este hermano ya tiene una salida activa en esa misma semana.'
    );
  }
};

const isWeekendMeetingData = (data: Record<string, unknown>): boolean => {
  const status = normalizeText(data.status);
  const type = normalizeText(data.type);
  const meetingCategory = normalizeText(data.meetingCategory);

  return status !== 'cancelled' && (
    meetingCategory === 'weekend' ||
    type === 'weekend' ||
    type === 'internal' ||
    type === 'external' ||
    type === 'review' ||
    type === 'training'
  );
};

const assertNoWeekendMeetingAssignmentConflict = async (params: {
  congregationId: string;
  speakerUserId: string;
  weekStartDate: string;
  weekEndDate: string;
}) => {
  const startDate = parseDateKey(params.weekStartDate);
  const endDate = parseDateKey(params.weekEndDate);

  if (!startDate || !endDate) {
    throw new HttpsError('invalid-argument', 'Rango de semana invalido.');
  }

  endDate.setHours(23, 59, 59, 999);

  const snapshot = await adminDb
    .collection('congregations')
    .doc(params.congregationId)
    .collection('meetings')
    .where('assignedUserIds', 'array-contains', params.speakerUserId)
    .where('meetingDate', '>=', Timestamp.fromDate(startDate))
    .where('meetingDate', '<=', Timestamp.fromDate(endDate))
    .limit(20)
    .get();

  const conflict = snapshot.docs.find((doc) =>
    isWeekendMeetingData(doc.data() as Record<string, unknown>)
  );

  if (conflict) {
    throw new HttpsError(
      'failed-precondition',
      'No se puede asignar. Este hermano ya tiene una asignacion en la reunion de fin de semana de esa semana.'
    );
  }
};

const writeOutgoingTalk = async (params: {
  payload: OutgoingTalkPayload;
  requesterUid: string;
  isCreate: boolean;
}) => {
  const requester = await getRequesterProfile(params.requesterUid);
  await assertAdministrativeBillingAccess(params.payload.congregationId);
  assertOutgoingTalkManager(requester, params.payload.congregationId);
  const speaker = await resolveSpeaker(params.payload.speakerUserId, params.payload.congregationId);
  const week = getWeekRangeForDate(params.payload.talkDate);

  if (params.payload.status === 'scheduled') {
    await assertNoDuplicateScheduledTalk({
      congregationId: params.payload.congregationId,
      speakerUserId: params.payload.speakerUserId,
      weekStartDate: week.weekStartDate,
      excludeOutgoingTalkId: params.payload.outgoingTalkId,
    });
    await assertNoWeekendMeetingAssignmentConflict({
      congregationId: params.payload.congregationId,
      speakerUserId: params.payload.speakerUserId,
      weekStartDate: week.weekStartDate,
      weekEndDate: week.weekEndDate,
    });
  }

  const collectionRef = adminDb
    .collection('congregations')
    .doc(params.payload.congregationId)
    .collection('outgoingTalks');
  const outgoingTalkId = params.payload.outgoingTalkId;
  if (!params.isCreate && !outgoingTalkId) {
    throw new HttpsError('invalid-argument', 'outgoingTalkId es obligatorio.');
  }
  const ref = params.isCreate ? collectionRef.doc() : collectionRef.doc(outgoingTalkId as string);

  if (!params.isCreate) {
    const current = await ref.get();
    if (!current.exists) {
      throw new HttpsError('not-found', 'Salida a discursar no encontrada.');
    }
    if (normalizeText(current.data()?.congregationId) !== params.payload.congregationId) {
      throw new HttpsError('permission-denied', 'No puedes editar salidas de otra congregacion.');
    }
  }

  const payload = {
    congregationId: params.payload.congregationId,
    speakerUserId: speaker.uid,
    speakerName: speaker.displayName,
    destinationCongregationName: params.payload.destinationCongregationName,
    talkDate: params.payload.talkDate,
    talkTime: params.payload.talkTime,
    weekStartDate: week.weekStartDate,
    weekEndDate: week.weekEndDate,
    status: params.payload.status ?? 'scheduled',
    notes: params.payload.notes ?? FieldValue.delete(),
    updatedBy: params.requesterUid,
    updatedAt: FieldValue.serverTimestamp(),
    ...(params.isCreate
      ? {
          createdBy: params.requesterUid,
          createdAt: FieldValue.serverTimestamp(),
        }
      : {}),
  };

  await ref.set(payload, { merge: true });

  if (params.isCreate) {
    await createInternalNotification({
      notificationId: `outgoingTalk-${ref.id}-${speaker.uid}`,
      userId: speaker.uid,
      congregationId: params.payload.congregationId,
      category: 'platform',
      title: 'Salida a discursar registrada',
      body: `Discursaras en ${params.payload.destinationCongregationName} el ${params.payload.talkDate} a las ${params.payload.talkTime}.`,
      assignmentId: ref.id,
      sentBy: params.requesterUid,
      metadata: {
        date: params.payload.talkDate,
        meetingId: null,
        meetingType: 'weekend',
        role: 'Salida a discursar',
      },
    });
  }

  return ref.id;
};

export const createOutgoingTalkByManager = onCall(
  { region: 'us-central1' },
  async (request): Promise<{ outgoingTalkId: string }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = parsePayload(request.data, false);
    const outgoingTalkId = await writeOutgoingTalk({
      payload,
      requesterUid: request.auth.uid,
      isCreate: true,
    });
    return { outgoingTalkId };
  }
);

export const updateOutgoingTalkByManager = onCall(
  { region: 'us-central1' },
  async (request): Promise<{ ok: true }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = parsePayload(request.data, true);
    await writeOutgoingTalk({
      payload,
      requesterUid: request.auth.uid,
      isCreate: false,
    });
    return { ok: true };
  }
);

const updateOutgoingTalkStatus = async (
  request: CallableRequest,
  status: 'cancelled' | 'completed'
): Promise<{ ok: true }> => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
  }

  const payload = parsePayload(request.data, true);
  if (!payload.outgoingTalkId) {
    throw new HttpsError('invalid-argument', 'outgoingTalkId es obligatorio.');
  }
  const requester = await getRequesterProfile(request.auth.uid);
  await assertAdministrativeBillingAccess(payload.congregationId);
  assertOutgoingTalkManager(requester, payload.congregationId);

  const ref = adminDb
    .collection('congregations')
    .doc(payload.congregationId)
    .collection('outgoingTalks')
    .doc(payload.outgoingTalkId);
  const current = await ref.get();

  if (!current.exists) {
    throw new HttpsError('not-found', 'Salida a discursar no encontrada.');
  }

  await ref.update({
    status,
    updatedBy: request.auth.uid,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { ok: true };
};

export const cancelOutgoingTalkByManager = onCall(
  { region: 'us-central1' },
  (request) => updateOutgoingTalkStatus(request, 'cancelled')
);

export const completeOutgoingTalkByManager = onCall(
  { region: 'us-central1' },
  (request) => updateOutgoingTalkStatus(request, 'completed')
);
