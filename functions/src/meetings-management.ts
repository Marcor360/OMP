import { FieldValue, Timestamp } from 'firebase-admin/firestore';
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
type MeetingStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
type MeetingPublicationStatus = 'draft' | 'published';
type MeetingProgramKind = 'midweek' | 'weekend';

type RequesterProfile = {
  role: UserRole;
  isActive: boolean;
  congregationId: string;
  displayName?: string;
  email?: string;
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
  };
};

const assertMeetingManager = (params: {
  requester: RequesterProfile;
  congregationId: string;
}) => {
  if (!params.requester.isActive) {
    throw new HttpsError('permission-denied', 'Tu usuario esta inactivo.');
  }

  if (params.requester.role !== 'admin' && params.requester.role !== 'supervisor') {
    throw new HttpsError(
      'permission-denied',
      'Solo admin y supervisor pueden crear, editar o eliminar reuniones.'
    );
  }

  if (params.requester.congregationId !== params.congregationId) {
    throw new HttpsError('permission-denied', 'No puedes gestionar reuniones de otra congregacion.');
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

const assertNoMeetingConflict = async (params: {
  congregationId: string;
  range: { meetingType: MeetingProgramKind; startDate: Timestamp; endDate: Timestamp };
  excludeMeetingId?: string;
}) => {
  const meetingsRef = adminDb
    .collection('congregations')
    .doc(params.congregationId)
    .collection('meetings');

  const [byMeetingDate, byStartDate] = await Promise.all([
    meetingsRef
      .where('meetingDate', '>=', params.range.startDate)
      .where('meetingDate', '<=', params.range.endDate)
      .limit(60)
      .get(),
    meetingsRef
      .where('startDate', '>=', params.range.startDate)
      .where('startDate', '<=', params.range.endDate)
      .limit(60)
      .get(),
  ]);

  const byId = new Map<string, Record<string, unknown>>();
  [...byMeetingDate.docs, ...byStartDate.docs].forEach((docSnap) => {
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
    const requester = await getRequesterProfile(request.auth.uid);

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
      throw new HttpsError('not-found', 'Reunion no encontrada.');
    }

    await meetingRef.delete();

    return { ok: true };
  }
);
