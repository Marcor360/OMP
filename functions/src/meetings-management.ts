import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { adminDb } from './config/firebaseAdmin.js';
import {
  buildAssignedUserIdsFromSections,
  normalizeMeetingSectionsFromDoc,
  resolveMeetingDate,
  resolveMeetingType,
  toFirestoreSectionsPayload,
} from './modules/meetings/meeting-sections.js';

type UserRole = 'admin' | 'supervisor' | 'user';
type ServiceAssignment = {
  position?: string;
  department?: string;
};
type UserPermissions = Record<string, Record<string, boolean> | undefined>;
type MeetingStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
type MeetingPublicationStatus = 'draft' | 'published';
type MeetingProgramKind = 'midweek' | 'weekend';

type RequesterProfile = {
  role: UserRole;
  isActive: boolean;
  congregationId: string;
  displayName?: string;
  email?: string;
  servicePosition?: string;
  serviceDepartment?: string;
  serviceAssignments?: ServiceAssignment[];
  permissions?: UserPermissions;
};

type CreateMeetingByManagerPayload = {
  congregationId?: unknown;
  meetingData?: unknown;
};

type UpdateMeetingByManagerPayload = {
  congregationId?: unknown;
  meetingId?: unknown;
  meetingData?: unknown;
};

type DeleteMeetingByManagerPayload = {
  congregationId?: unknown;
  meetingId?: unknown;
};

type SyncMeetingCleaningAssignmentsPayload = {
  congregationId?: unknown;
  meetingId?: unknown;
  mode?: unknown;
  groups?: unknown;
  meetingTitle?: unknown;
  meetingDate?: unknown;
  assignedByName?: unknown;
};

type CreateMeetingAssignmentPayload = {
  congregationId?: unknown;
  meetingId?: unknown;
  assignmentData?: unknown;
  assignedByName?: unknown;
};

type UpdateMeetingAssignmentPayload = {
  congregationId?: unknown;
  meetingId?: unknown;
  assignmentId?: unknown;
  assignmentData?: unknown;
};

type DeleteMeetingAssignmentPayload = {
  congregationId?: unknown;
  meetingId?: unknown;
  assignmentId?: unknown;
};

const ASSIGNMENT_PROTECTED_FIELDS = new Set([
  'createdBy', 'createdAt', 'updatedBy', 'updatedAt', 'congregationId', 'meetingId',
]);

const sanitizeAssignmentInput = (data: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(data).filter(([key]) => !ASSIGNMENT_PROTECTED_FIELDS.has(key)));

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeRole = (value: unknown): UserRole | undefined => {
  if (value === 'admin' || value === 'supervisor' || value === 'user') {
    return value;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'admin' || normalized === 'administrador') {
    return 'admin';
  }
  if (normalized === 'supervisor') {
    return 'supervisor';
  }
  if (normalized === 'user' || normalized === 'usuario') {
    return 'user';
  }

  return undefined;
};

const normalizeIsActive = (data: Record<string, unknown>): boolean => {
  if (typeof data.isActive === 'boolean') {
    return data.isActive;
  }

  if (typeof data.active === 'boolean') {
    return data.active;
  }

  const status = normalizeText(data.status)?.toLowerCase();
  if (status === 'active' || status === 'activo') {
    return true;
  }
  if (
    status === 'inactive' ||
    status === 'inactivo' ||
    status === 'suspended' ||
    status === 'suspendido'
  ) {
    return false;
  }

  return false;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => normalizeText(item))
    .filter((item): item is string => Boolean(item));
};

const toServiceAssignments = (value: unknown): ServiceAssignment[] => {
  if (!Array.isArray(value)) return [];

  return value.reduce<ServiceAssignment[]>((items, item) => {
    const record = asRecord(item);
    const position = normalizeText(record?.position);
    if (!position) return items;

    items.push({
      position,
      department: normalizeText(record?.department),
    });
    return items;
  }, []);
};

const hasServiceAssignment = (
  user: Pick<RequesterProfile, 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'>,
  position: string,
  department: string
): boolean =>
  (
    user.servicePosition === position &&
    user.serviceDepartment === department
  ) ||
  user.serviceAssignments?.some(
    (assignment) =>
      assignment.position === position &&
      assignment.department === department
  ) === true;

const isMeetingsManager = (requester: RequesterProfile): boolean =>
  requester.role === 'admin' ||
  requester.role === 'supervisor' ||
  requester.permissions?.reuniones?.manage === true ||
  (
    requester.permissions?.reuniones?.create === true &&
    requester.permissions?.reuniones?.edit === true
  ) ||
  hasServiceAssignment(requester, 'encargado', 'reuniones');

const toCleaningMode = (value: unknown): 'none' | 'selected' | 'all' => {
  if (value === 'selected' || value === 'all') return value;
  return 'none';
};

const toCleaningGroups = (value: unknown): { id: string; name: string }[] => {
  if (!Array.isArray(value)) return [];

  const byId = new Map<string, { id: string; name: string }>();
  value.forEach((item) => {
    const record = asRecord(item);
    const id = normalizeText(record?.id);
    if (!id) return;

    byId.set(id, {
      id,
      name: normalizeText(record?.name) ?? 'Grupo de limpieza',
    });
  });

  return Array.from(byId.values());
};

const toTimestamp = (value: unknown): Timestamp | undefined => {
  if (value instanceof Timestamp) {
    return value;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return Timestamp.fromDate(value);
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return Timestamp.fromDate(parsed);
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Timestamp.fromMillis(value);
  }

  const raw = asRecord(value);
  if (!raw) return undefined;

  const toDate = raw.toDate;
  if (typeof toDate === 'function') {
    const parsed = (toDate as () => Date)();
    if (!Number.isNaN(parsed.getTime())) {
      return Timestamp.fromDate(parsed);
    }
  }

  if (typeof raw.seconds === 'number' && typeof raw.nanoseconds === 'number') {
    return new Timestamp(raw.seconds, raw.nanoseconds);
  }

  return undefined;
};

const sanitizeForFirestore = (value: unknown): unknown => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (value instanceof Timestamp) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeForFirestore(item))
      .filter((item) => item !== undefined);
  }

  if (typeof value === 'object') {
    const plain = asRecord(value);
    if (!plain) {
      return value;
    }

    const output: Record<string, unknown> = {};

    Object.entries(plain).forEach(([key, child]) => {
      const sanitized = sanitizeForFirestore(child);
      if (sanitized !== undefined) {
        output[key] = sanitized;
      }
    });

    return output;
  }

  return value;
};

const isMeetingStatus = (value: unknown): value is MeetingStatus =>
  value === 'pending' ||
  value === 'scheduled' ||
  value === 'in_progress' ||
  value === 'completed' ||
  value === 'cancelled';

const normalizeMeetingStatus = (value: unknown): MeetingStatus =>
  isMeetingStatus(value) ? value : 'scheduled';

const isPublicationStatus = (value: unknown): value is MeetingPublicationStatus =>
  value === 'draft' || value === 'published';

const normalizePublicationStatus = (value: unknown): MeetingPublicationStatus =>
  isPublicationStatus(value) ? value : 'draft';

const buildMeetingSearchableText = (params: {
  title: string;
  description?: string;
  sections: ReturnType<typeof normalizeMeetingSectionsFromDoc>;
}): string => {
  const parts: string[] = [params.title, params.description ?? ''];

  params.sections.forEach((section) => {
    parts.push(section.title);
    section.assignments.forEach((assignment) => {
      parts.push(assignment.title);
      assignment.assignees.forEach((assignee) => {
        parts.push(assignee.assigneeNameSnapshot ?? '');
      });
    });
  });

  return parts.join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
};

const parseCongregationId = (value: unknown): string => {
  const congregationId = normalizeText(value);
  if (!congregationId) {
    throw new HttpsError('invalid-argument', 'congregationId es obligatorio.');
  }

  return congregationId;
};

const parseMeetingId = (value: unknown): string => {
  const meetingId = normalizeText(value);
  if (!meetingId) {
    throw new HttpsError('invalid-argument', 'meetingId es obligatorio.');
  }

  return meetingId;
};

const parseMeetingData = (value: unknown): Record<string, unknown> => {
  const meetingData = asRecord(value);
  if (!meetingData) {
    throw new HttpsError('invalid-argument', 'meetingData es obligatorio.');
  }

  return meetingData;
};

const parseAssignmentData = (value: unknown): Record<string, unknown> => {
  const assignmentData = asRecord(value);
  if (!assignmentData) {
    throw new HttpsError('invalid-argument', 'assignmentData es obligatorio.');
  }

  return assignmentData;
};

const getRequesterProfile = async (uid: string): Promise<RequesterProfile> => {
  const snap = await adminDb.collection('users').doc(uid).get();

  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'No existe perfil del usuario autenticado.');
  }

  const data = snap.data() as Record<string, unknown>;
  const role = normalizeRole(data.role);
  const congregationId = normalizeText(data.congregationId);
  const isActive = normalizeIsActive(data);

  if (!role || !congregationId) {
    throw new HttpsError('permission-denied', 'Perfil de usuario invalido.');
  }

  return {
    role,
    isActive,
    congregationId,
    displayName: normalizeText(data.displayName),
    email: normalizeText(data.email),
    servicePosition: normalizeText(data.servicePosition),
    serviceDepartment: normalizeText(data.serviceDepartment),
    serviceAssignments: toServiceAssignments(data.serviceAssignments),
    permissions: data.permissions as UserPermissions | undefined,
  };
};

const assertMeetingManager = (params: {
  requester: RequesterProfile;
  congregationId: string;
}) => {
  if (!params.requester.isActive) {
    throw new HttpsError('permission-denied', 'Tu usuario esta inactivo.');
  }

  if (!isMeetingsManager(params.requester)) {
    throw new HttpsError(
      'permission-denied',
      'Solo admin, supervisor o encargado de reuniones pueden crear, editar o eliminar reuniones.'
    );
  }

  if (params.requester.congregationId !== params.congregationId) {
    throw new HttpsError('permission-denied', 'No puedes gestionar reuniones de otra congregacion.');
  }
};

const assertNoOutgoingTalkConflictForUser = async (params: {
  congregationId: string;
  userId?: string;
  assignmentDate?: Timestamp;
}) => {
  const userId = normalizeText(params.userId);
  if (!userId || userId.startsWith('manual:') || !params.assignmentDate) return;

  const weekStartDate = getWeekStartKeyFromTimestamp(params.assignmentDate);
  const snapshot = await adminDb
    .collection('congregations')
    .doc(params.congregationId)
    .collection('outgoingTalks')
    .where('speakerUserId', '==', userId)
    .where('status', '==', 'scheduled')
    .where('weekStartDate', '==', weekStartDate)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    const data = snapshot.docs[0].data() as Record<string, unknown>;
    throw new HttpsError(
      'failed-precondition',
      `${normalizeText(data.speakerName) ?? userId} no esta disponible: salida a discursar esta semana.`
    );
  }
};

const toMeetingRangeFromData = (data: Record<string, unknown>): {
  meetingType: MeetingProgramKind;
  startDate: Timestamp;
  endDate: Timestamp;
} => {
  const meetingType = resolveMeetingType(data);
  const now = Timestamp.now();
  const startDate = toTimestamp(data.startDate) ?? resolveMeetingDate(data) ?? now;
  const endDate = toTimestamp(data.endDate) ?? startDate;

  return {
    meetingType,
    startDate,
    endDate,
  };
};

const toStartOfTodayTimestamp = (): Timestamp => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(today);
};

const rangesOverlap = (params: {
  leftStart: Timestamp;
  leftEnd: Timestamp;
  rightStart: Timestamp;
  rightEnd: Timestamp;
}): boolean =>
  params.leftStart.toMillis() <= params.rightEnd.toMillis() &&
  params.rightStart.toMillis() <= params.leftEnd.toMillis();

const formatShortDate = (value: Timestamp): string =>
  value.toDate().toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const formatDateKey = (value: Date): string =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

const getWeekStartKeyFromTimestamp = (value: Timestamp): string => {
  const date = value.toDate();
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const shift = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + shift);
  return formatDateKey(date);
};

const resolveErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const assertNoMeetingConflict = async (params: {
  congregationId: string;
  range: { meetingType: MeetingProgramKind; startDate: Timestamp; endDate: Timestamp };
  excludeMeetingId?: string;
}) => {
  const meetingsRef = adminDb
    .collection('congregations')
    .doc(params.congregationId)
    .collection('meetings');

  const fallbackQueryPromise = Promise.all([
    meetingsRef
      .where('meetingDate', '>=', params.range.startDate)
      .where('meetingDate', '<=', params.range.endDate)
      .limit(120)
      .get(),
    meetingsRef
      .where('startDate', '>=', params.range.startDate)
      .where('startDate', '<=', params.range.endDate)
      .limit(120)
      .get(),
  ]);

  let overlapSnapshot: FirebaseFirestore.QuerySnapshot | null = null;

  try {
    overlapSnapshot = await meetingsRef
      .where('startDate', '<=', params.range.endDate)
      .where('endDate', '>=', params.range.startDate)
      .limit(120)
      .get();
  } catch (error) {
    logger.warn(
      'No se pudo ejecutar consulta de traslape por rango; usando validacion de compatibilidad.',
      {
        congregationId: params.congregationId,
        error: resolveErrorMessage(error),
      }
    );
  }

  const [byMeetingDate, byStartDate] = await fallbackQueryPromise;

  const byId = new Map<string, Record<string, unknown>>();
  const candidateDocs = overlapSnapshot
    ? [...overlapSnapshot.docs, ...byMeetingDate.docs, ...byStartDate.docs]
    : [...byMeetingDate.docs, ...byStartDate.docs];
  candidateDocs.forEach((docSnap) => {
    byId.set(docSnap.id, docSnap.data() as Record<string, unknown>);
  });

  const conflict = Array.from(byId.entries()).find(([docId, raw]) => {
    if (params.excludeMeetingId && docId === params.excludeMeetingId) {
      return false;
    }

    if (resolveMeetingType(raw) !== params.range.meetingType) {
      return false;
    }

    const currentStart = toTimestamp(raw.startDate) ?? resolveMeetingDate(raw);
    const currentEnd = toTimestamp(raw.endDate) ?? currentStart;

    if (!currentStart || !currentEnd) {
      return false;
    }

    return rangesOverlap({
      leftStart: params.range.startDate,
      leftEnd: params.range.endDate,
      rightStart: currentStart,
      rightEnd: currentEnd,
    });
  });

  if (conflict) {
    throw new HttpsError(
      'already-exists',
      `Ya existe una reunion de ${
        params.range.meetingType === 'midweek' ? 'entre semana' : 'fin de semana'
      } para ese rango (${formatShortDate(params.range.startDate)} al ${formatShortDate(
        params.range.endDate
      )}).`
    );
  }
};

const assertNoOutgoingTalkAssignmentConflict = async (params: {
  congregationId: string;
  meetingData: Record<string, unknown>;
}) => {
  if (resolveMeetingType(params.meetingData) !== 'weekend') return;

  const sections = normalizeMeetingSectionsFromDoc(params.meetingData);
  const assignedUserIds = buildAssignedUserIdsFromSections(sections);
  if (assignedUserIds.length === 0) return;

  const meetingDate =
    resolveMeetingDate(params.meetingData) ??
    toTimestamp(params.meetingData.startDate) ??
    Timestamp.now();
  const weekStartDate = getWeekStartKeyFromTimestamp(meetingDate);

  const snapshot = await adminDb
    .collection('congregations')
    .doc(params.congregationId)
    .collection('outgoingTalks')
    .where('status', '==', 'scheduled')
    .where('weekStartDate', '==', weekStartDate)
    .limit(100)
    .get();

  const blockedByUserId = new Map<string, string>();
  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const speakerUserId = normalizeText(data.speakerUserId);
    if (!speakerUserId) return;
    blockedByUserId.set(
      speakerUserId,
      normalizeText(data.speakerName) ?? speakerUserId
    );
  });

  const conflict = assignedUserIds.find((userId) => blockedByUserId.has(userId));
  if (conflict) {
    const dateKey = formatDateKey(meetingDate.toDate());
    throw new HttpsError(
      'failed-precondition',
      `${blockedByUserId.get(conflict) ?? conflict} no esta disponible el fin de semana de ${dateKey}: salida a discursar esta semana.`
    );
  }
};

const buildMeetingWritePayload = (params: {
  meetingData: Record<string, unknown>;
  requesterUid: string;
  requesterName: string;
  isCreate: boolean;
}): Record<string, unknown> => {
  const meetingType = resolveMeetingType(params.meetingData);
  const meetingCategory = meetingType === 'midweek' ? 'midweek' : 'weekend';
  const sections = normalizeMeetingSectionsFromDoc(params.meetingData);
  const assignedUserIds = buildAssignedUserIdsFromSections(sections);
  const startDate = toTimestamp(params.meetingData.startDate);
  const endDate = toTimestamp(params.meetingData.endDate);
  const resolvedMeetingDate = resolveMeetingDate(params.meetingData);
  const now = Timestamp.now();
  const effectiveStartDate = startDate ?? resolvedMeetingDate ?? now;
  const effectiveMeetingDate = resolvedMeetingDate ?? effectiveStartDate;
  const effectiveEndDate = endDate ?? effectiveMeetingDate;
  const attendees = Array.from(
    new Set([params.requesterUid, ...toStringArray(params.meetingData.attendees)])
  );

  const title =
    normalizeText(params.meetingData.title) ??
    (meetingType === 'midweek'
      ? 'Reunion Vida y Ministerio Cristianos'
      : 'Reunion del fin de semana');
  const description = normalizeText(params.meetingData.description);

  const basePayload = sanitizeForFirestore({
    title,
    description,
    type: meetingType,
    meetingCategory,
    status: normalizeMeetingStatus(params.meetingData.status),
    publicationStatus: normalizePublicationStatus(params.meetingData.publicationStatus),
    weekLabel: normalizeText(params.meetingData.weekLabel),
    bibleReading: normalizeText(params.meetingData.bibleReading),
    startDate: effectiveStartDate,
    endDate: effectiveEndDate,
    meetingDate: effectiveMeetingDate,
    publishedAt: toTimestamp(params.meetingData.publishedAt),
    location: normalizeText(params.meetingData.location),
    meetingUrl: normalizeText(params.meetingData.meetingUrl),
    zoomMeetingId: normalizeText(params.meetingData.zoomMeetingId),
    zoomPasscode: normalizeText(params.meetingData.zoomPasscode),
    attendees,
    attendeeNames: toStringArray(params.meetingData.attendeeNames),
    notes: normalizeText(params.meetingData.notes),
    openingSong: normalizeText(params.meetingData.openingSong),
    openingPrayer: normalizeText(params.meetingData.openingPrayer),
    closingSong: normalizeText(params.meetingData.closingSong),
    closingPrayer: normalizeText(params.meetingData.closingPrayer),
    chairman: normalizeText(params.meetingData.chairman),
    sections: toFirestoreSectionsPayload(sections),
    assignedUserIds,
    cleaningAssignmentMode: toCleaningMode(params.meetingData.cleaningAssignmentMode),
    cleaningGroupIds: toStringArray(params.meetingData.cleaningGroupIds),
    cleaningGroupNames: toStringArray(params.meetingData.cleaningGroupNames),
    searchableText:
      normalizeText(params.meetingData.searchableText) ??
      buildMeetingSearchableText({
        title,
        description,
        sections,
      }),
    midweekSections:
      meetingType === 'midweek' && Array.isArray(params.meetingData.midweekSections)
        ? params.meetingData.midweekSections
        : null,
    organizerUid: normalizeText(params.meetingData.organizerUid) ?? params.requesterUid,
    organizerName: normalizeText(params.meetingData.organizerName) ?? params.requesterName,
    createdBy: params.isCreate
      ? params.requesterUid
      : normalizeText(params.meetingData.createdBy),
    updatedBy: params.requesterUid,
  }) as Record<string, unknown>;

  if (params.isCreate) {
    return {
      ...basePayload,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
  }

  return {
    ...basePayload,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: params.requesterUid,
  };
};

export const createMeetingByManager = onCall(
  { region: 'us-central1' },
  async (request): Promise<{ meetingId: string }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = request.data as CreateMeetingByManagerPayload;
    const congregationId = parseCongregationId(payload.congregationId);
    const meetingData = parseMeetingData(payload.meetingData);
    const requesterUid = request.auth.uid;
    const requester = await getRequesterProfile(requesterUid);

    assertMeetingManager({ requester, congregationId });
    const meetingRange = toMeetingRangeFromData(meetingData);

    if (meetingRange.endDate.toMillis() < toStartOfTodayTimestamp().toMillis()) {
      throw new HttpsError(
        'failed-precondition',
        'No se pueden crear reuniones con fechas que ya pasaron.'
      );
    }

    await assertNoMeetingConflict({
      congregationId,
      range: meetingRange,
    });

    await assertNoOutgoingTalkAssignmentConflict({
      congregationId,
      meetingData,
    });

    const meetingPayload = buildMeetingWritePayload({
      meetingData,
      requesterUid: request.auth.uid,
      requesterName:
        requester.displayName ?? requester.email ?? 'Usuario',
      isCreate: true,
    });

    const ref = await adminDb
      .collection('congregations')
      .doc(congregationId)
      .collection('meetings')
      .add(meetingPayload);

    return { meetingId: ref.id };
  }
);

export const updateMeetingByManager = onCall(
  { region: 'us-central1' },
  async (request): Promise<{ ok: true }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = request.data as UpdateMeetingByManagerPayload;
    const congregationId = parseCongregationId(payload.congregationId);
    const meetingId = parseMeetingId(payload.meetingId);
    const meetingData = parseMeetingData(payload.meetingData);
    const requester = await getRequesterProfile(request.auth.uid);

    assertMeetingManager({ requester, congregationId });

    const meetingRef = adminDb
      .collection('congregations')
      .doc(congregationId)
      .collection('meetings')
      .doc(meetingId);

    const meetingSnap = await meetingRef.get();
    if (!meetingSnap.exists) {
      throw new HttpsError('not-found', 'Reunion no encontrada.');
    }

    const mergedMeetingData = {
      ...(meetingSnap.data() as Record<string, unknown>),
      ...meetingData,
    };
    const mergedRange = toMeetingRangeFromData(mergedMeetingData);

    await assertNoMeetingConflict({
      congregationId,
      range: mergedRange,
      excludeMeetingId: meetingId,
    });

    await assertNoOutgoingTalkAssignmentConflict({
      congregationId,
      meetingData: mergedMeetingData,
    });

    const updatePayload = buildMeetingWritePayload({
      meetingData: mergedMeetingData,
      requesterUid: request.auth.uid,
      requesterName:
        requester.displayName ?? requester.email ?? 'Usuario',
      isCreate: false,
    });

    await meetingRef.update(updatePayload);

    return { ok: true };
  }
);

export const syncMeetingCleaningAssignmentsByManager = onCall(
  { region: 'us-central1' },
  async (request): Promise<{ ok: true }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = request.data as SyncMeetingCleaningAssignmentsPayload;
    const congregationId = parseCongregationId(payload.congregationId);
    const meetingId = parseMeetingId(payload.meetingId);
    const requesterUid = request.auth.uid;
    const requester = await getRequesterProfile(requesterUid);

    assertMeetingManager({ requester, congregationId });

    const meetingRef = adminDb
      .collection('congregations')
      .doc(congregationId)
      .collection('meetings')
      .doc(meetingId);
    const meetingSnap = await meetingRef.get();
    if (!meetingSnap.exists) {
      throw new HttpsError('not-found', 'Reunion no encontrada.');
    }

    const mode = toCleaningMode(payload.mode);
    const groups = mode === 'none' ? [] : toCleaningGroups(payload.groups);
    const meetingData = (meetingSnap.data() ?? {}) as Record<string, unknown>;
    const meetingDate = toTimestamp(payload.meetingDate) ?? resolveMeetingDate(meetingData);
    const meetingTitle =
      normalizeText(payload.meetingTitle) ??
      normalizeText(meetingData.title) ??
      'Reunion';
    const assignedByName =
      normalizeText(payload.assignedByName) ??
      requester.displayName ??
      requester.email ??
      'Usuario';

    const assignmentsRef = meetingRef.collection('assignments');
    const existingSnap = await assignmentsRef
      .where('source', '==', 'meeting-cleaning')
      .get();
    const existingIds = new Set(existingSnap.docs.map((doc) => doc.id));
    const targetIds = new Set(groups.map((group) => `cleaning-${group.id}`));
    const batch = adminDb.batch();

    existingSnap.docs.forEach((docSnap) => {
      if (!targetIds.has(docSnap.id)) {
        batch.delete(docSnap.ref);
      }
    });

    groups.forEach((group) => {
      const assignmentId = `cleaning-${group.id}`;
      const ref = assignmentsRef.doc(assignmentId);
      const isExisting = existingIds.has(assignmentId);

      batch.set(
        ref,
        sanitizeForFirestore({
          congregationId,
          meetingId,
          source: 'meeting-cleaning',
          category: 'cleaning',
          type: 'cleaning',
          title: mode === 'all' ? `Limpieza general - ${group.name}` : `Limpieza - ${group.name}`,
          description: meetingTitle,
          notes: meetingTitle,
          priority: 'medium',
          cleaningGroupId: group.id,
          cleaningGroupName: group.name,
          assignedToUid: group.id,
          assignedToName: group.name,
          assignedByUid: requesterUid,
          assignedByName,
          createdBy: requesterUid,
          updatedBy: requesterUid,
          dueDate: meetingDate,
          date: meetingDate,
          status: 'pending',
          assignedUsers: [],
          ...(isExisting ? {} : { createdAt: FieldValue.serverTimestamp() }),
          updatedAt: FieldValue.serverTimestamp(),
        }) as Record<string, unknown>,
        { merge: true }
      );
    });

    batch.update(
      meetingRef,
      sanitizeForFirestore({
        cleaningAssignmentMode: mode,
        cleaningGroupIds: groups.map((group) => group.id),
        cleaningGroupNames: groups.map((group) => group.name),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: requesterUid,
      }) as Record<string, unknown>
    );

    await batch.commit();
    return { ok: true };
  }
);

export const createMeetingAssignmentByManager = onCall(
  { region: 'us-central1' },
  async (request): Promise<{ assignmentId: string }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = request.data as CreateMeetingAssignmentPayload;
    const congregationId = parseCongregationId(payload.congregationId);
    const meetingId = parseMeetingId(payload.meetingId);
    const assignmentData = sanitizeAssignmentInput(parseAssignmentData(payload.assignmentData));
    const requester = await getRequesterProfile(request.auth.uid);
    assertMeetingManager({ requester, congregationId });

    const meetingRef = adminDb.collection('congregations').doc(congregationId)
      .collection('meetings').doc(meetingId);
    if (!(await meetingRef.get()).exists) {
      throw new HttpsError('not-found', 'Reunion no encontrada.');
    }

    const dueDate = toTimestamp(assignmentData.dueDate) ?? toTimestamp(assignmentData.date);
    await assertNoOutgoingTalkConflictForUser({
      congregationId,
      userId: normalizeText(assignmentData.assignedToUid),
      assignmentDate: dueDate,
    });

    const ref = await meetingRef.collection('assignments')
      .add(
        sanitizeForFirestore({
          ...assignmentData,
          congregationId,
          meetingId,
          assignedByUid: request.auth.uid,
          assignedByName:
            normalizeText(payload.assignedByName) ??
            requester.displayName ??
            requester.email ??
            'Usuario',
          status: normalizeText(assignmentData.status) ?? 'pending',
          createdBy: request.auth.uid,
          updatedBy: request.auth.uid,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }) as Record<string, unknown>
      );

    return { assignmentId: ref.id };
  }
);

export const updateMeetingAssignmentByManager = onCall(
  { region: 'us-central1' },
  async (request): Promise<{ ok: true }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = request.data as UpdateMeetingAssignmentPayload;
    const congregationId = parseCongregationId(payload.congregationId);
    const meetingId = parseMeetingId(payload.meetingId);
    const assignmentId = parseMeetingId(payload.assignmentId);
    const assignmentData = sanitizeAssignmentInput(parseAssignmentData(payload.assignmentData));
    const requester = await getRequesterProfile(request.auth.uid);
    assertMeetingManager({ requester, congregationId });

    const meetingRef = adminDb.collection('congregations').doc(congregationId)
      .collection('meetings').doc(meetingId);
    if (!(await meetingRef.get()).exists) {
      throw new HttpsError('not-found', 'Reunion no encontrada.');
    }

    const ref = adminDb
      .collection('congregations')
      .doc(congregationId)
      .collection('meetings')
      .doc(meetingId)
      .collection('assignments')
      .doc(assignmentId);
    const current = await ref.get();
    if (!current.exists) {
      throw new HttpsError('not-found', 'Asignacion no encontrada.');
    }

    const merged = {
      ...(current.data() as Record<string, unknown>),
      ...assignmentData,
    };
    const dueDate = toTimestamp(merged.dueDate) ?? toTimestamp(merged.date);
    await assertNoOutgoingTalkConflictForUser({
      congregationId,
      userId: normalizeText(merged.assignedToUid),
      assignmentDate: dueDate,
    });

    await ref.update(
      sanitizeForFirestore({
        ...assignmentData,
        congregationId,
        meetingId,
        updatedBy: request.auth.uid,
        updatedAt: FieldValue.serverTimestamp(),
        ...(assignmentData.status === 'completed'
          ? { completedAt: FieldValue.serverTimestamp() }
          : {}),
      }) as Record<string, unknown>
    );

    return { ok: true };
  }
);

export const deleteMeetingAssignmentByManager = onCall(
  {region: 'us-central1'},
  async (request): Promise<{ok: true; assignmentId: string; notificationsDeleted: number}> => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    const payload = request.data as DeleteMeetingAssignmentPayload;
    const congregationId = parseCongregationId(payload.congregationId);
    const meetingId = parseMeetingId(payload.meetingId);
    const assignmentId = parseMeetingId(payload.assignmentId);
    const requester = await getRequesterProfile(request.auth.uid);
    assertMeetingManager({requester, congregationId});

    const congregationRef = adminDb.collection('congregations').doc(congregationId);
    const meetingRef = congregationRef.collection('meetings').doc(meetingId);
    const assignmentRef = meetingRef.collection('assignments').doc(assignmentId);
    const [meetingSnap, assignmentSnap] = await Promise.all([meetingRef.get(), assignmentRef.get()]);
    if (!meetingSnap.exists) throw new HttpsError('not-found', 'Reunion no encontrada.');
    if (!assignmentSnap.exists) return {ok: true, assignmentId, notificationsDeleted: 0};

    const notifications = await congregationRef.collection('notifications')
      .where('assignmentId', '==', assignmentId).get();
    const writer = adminDb.bulkWriter();
    const relatedNotifications = notifications.docs.filter((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const metadata = asRecord(data.metadata);
      return normalizeText(data.meetingId) === meetingId || normalizeText(metadata?.meetingId) === meetingId;
    });
    relatedNotifications.forEach((doc) => writer.delete(doc.ref));
    writer.delete(assignmentRef);
    await writer.close();
    await congregationRef.collection('changeLogs').add({
      action: 'meeting_assignment_deleted', meetingId, assignmentId,
      congregationId, performedBy: request.auth.uid,
      performedAt: FieldValue.serverTimestamp(),
    });
    return {ok: true, assignmentId, notificationsDeleted: relatedNotifications.length};
  }
);

export const deleteMeetingByManager = onCall(
  { region: 'us-central1' },
  async (request): Promise<{ ok: true }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = request.data as DeleteMeetingByManagerPayload;
    const congregationId = parseCongregationId(payload.congregationId);
    const meetingId = parseMeetingId(payload.meetingId);
    const requester = await getRequesterProfile(request.auth.uid);

    assertMeetingManager({ requester, congregationId });

    const meetingRef = adminDb
      .collection('congregations')
      .doc(congregationId)
      .collection('meetings')
      .doc(meetingId);

    const meetingSnap = await meetingRef.get();
    if (!meetingSnap.exists) {
      return {ok: true};
    }

    const notificationsRef = adminDb.collection('congregations').doc(congregationId).collection('notifications');
    const [metadataNotifications, directNotifications] = await Promise.all([
      notificationsRef.where('metadata.meetingId', '==', meetingId).get(),
      notificationsRef.where('meetingId', '==', meetingId).get(),
    ]);
    const writer = adminDb.bulkWriter();
    const notificationRefs = new Map([...metadataNotifications.docs, ...directNotifications.docs]
      .map((doc) => [doc.ref.path, doc.ref]));
    notificationRefs.forEach((ref) => writer.delete(ref));
    await writer.close();
    await adminDb.recursiveDelete(meetingRef);
    await adminDb.collection('congregations').doc(congregationId).collection('changeLogs').add({
      action: 'meeting_deleted', meetingId, congregationId,
      performedBy: request.auth.uid, performedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true };
  }
);
