import {
  Timestamp,
  addDoc,
  deleteDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { congregationMeetingsCollectionRef, meetingDocRef } from '@/src/lib/firebase/refs';
import { isFirebaseErrorCode } from '@/src/lib/firebase/errors';
import {
  logFirestoreListenerCreated,
  logFirestoreListenerDestroyed,
} from '@/src/services/firebase/firestore-debug';
import {
  getDocumentCacheFirst,
  getQueryCacheFirst,
  invalidateCacheEntry,
} from '@/src/services/repositories/firestore-cache-first';
import { clearSessionCacheByPrefix } from '@/src/services/repositories/session-cache';
import {
  CreateMeetingDTO,
  Meeting,
  MeetingCategory,
  MeetingStatus,
  MeetingType,
  UpdateMeetingDTO,
} from '@/src/types/meeting';
import {
  buildMeetingSearchableText,
  collectAssignedUserIds,
  createDefaultSectionsForMeetingType,
  MeetingPublicationStatus,
  normalizeMeetingSections,
} from '@/src/types/meeting/program';
import {
  convertLegacyMidweekSectionsToProgramSections,
  convertProgramSectionsToLegacyMidweekSections,
  normalizeMeetingProgramPayload,
} from '@/src/services/meetings/meeting-program-utils';
import { sanitizeForFirestore } from '@/src/services/meetings/firestore-payload';
import {
  createMeetingByManager,
  deleteMeetingByManager,
  updateMeetingByManager,
} from '@/src/services/meetings/manager-meetings-service';
import { AppError } from '@/src/utils/errors/errors';

const isMeetingStatus = (value: unknown): value is MeetingStatus =>
  value === 'pending' ||
  value === 'scheduled' ||
  value === 'in_progress' ||
  value === 'completed' ||
  value === 'cancelled';

const isMeetingType = (value: unknown): value is MeetingType =>
  value === 'internal' ||
  value === 'external' ||
  value === 'review' ||
  value === 'training' ||
  value === 'midweek' ||
  value === 'weekend';

const isMeetingCategory = (value: unknown): value is MeetingCategory =>
  value === 'general' || value === 'midweek' || value === 'weekend';

const isPublicationStatus = (value: unknown): value is MeetingPublicationStatus =>
  value === 'draft' || value === 'published';

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0
  );
};

const normalizeMeeting = (id: string, data: Record<string, unknown>): Meeting => {
  const rawType = isMeetingType(data.type) ? data.type : 'weekend';
  const meetingCategory = isMeetingCategory(data.meetingCategory)
    ? data.meetingCategory
    : rawType === 'midweek'
      ? 'midweek'
      : rawType === 'weekend'
        ? 'weekend'
      : 'general';
  const inferredProgramType =
    rawType === 'midweek' || meetingCategory === 'midweek' ? 'midweek' : 'weekend';
  const normalizedSections = Array.isArray(data.sections)
    ? normalizeMeetingSections(data.sections, inferredProgramType)
    : inferredProgramType === 'midweek' && Array.isArray(data.midweekSections)
      ? convertLegacyMidweekSectionsToProgramSections(data.midweekSections as never)
      : createDefaultSectionsForMeetingType(inferredProgramType);
  const title = typeof data.title === 'string' ? data.title : '';
  const description =
    typeof data.description === 'string' ? data.description : undefined;

  return {
    id,
    title,
    description,
    type: meetingCategory === 'midweek' ? 'midweek' : rawType,
    meetingCategory,
    status: isMeetingStatus(data.status) ? data.status : 'scheduled',
    publicationStatus: isPublicationStatus(data.publicationStatus)
      ? data.publicationStatus
      : 'published',
    weekLabel: typeof data.weekLabel === 'string' ? data.weekLabel : undefined,
    bibleReading:
      typeof data.bibleReading === 'string' ? data.bibleReading : undefined,
    startDate: (data.startDate as Meeting['startDate']) ?? Timestamp.now(),
    endDate: (data.endDate as Meeting['endDate']) ?? Timestamp.now(),
    meetingDate:
      (data.meetingDate as Meeting['meetingDate']) ??
      (data.startDate as Meeting['startDate']) ??
      Timestamp.now(),
    publishedAt: data.publishedAt as Meeting['publishedAt'],
    location: typeof data.location === 'string' ? data.location : undefined,
    meetingUrl: typeof data.meetingUrl === 'string' ? data.meetingUrl : undefined,
    zoomMeetingId:
      typeof data.zoomMeetingId === 'string' ? data.zoomMeetingId : undefined,
    zoomPasscode:
      typeof data.zoomPasscode === 'string' ? data.zoomPasscode : undefined,
    organizerUid: typeof data.organizerUid === 'string' ? data.organizerUid : '',
    organizerName:
      typeof data.organizerName === 'string' ? data.organizerName : 'Sistema',
    attendees: Array.isArray(data.attendees)
      ? data.attendees.filter((value): value is string => typeof value === 'string')
      : [],
    attendeeNames: Array.isArray(data.attendeeNames)
      ? data.attendeeNames.filter((value): value is string => typeof value === 'string')
      : undefined,
    assignedUserIds:
      toStringArray(data.assignedUserIds).length > 0
        ? toStringArray(data.assignedUserIds)
        : collectAssignedUserIds(normalizedSections),
    searchableText:
      typeof data.searchableText === 'string'
        ? data.searchableText
        : buildMeetingSearchableText({
            title,
            description,
            sections: normalizedSections,
          }),
    notes: typeof data.notes === 'string' ? data.notes : undefined,
    openingSong: typeof data.openingSong === 'string' ? data.openingSong : undefined,
    openingPrayer:
      typeof data.openingPrayer === 'string' ? data.openingPrayer : undefined,
    closingSong: typeof data.closingSong === 'string' ? data.closingSong : undefined,
    closingPrayer:
      typeof data.closingPrayer === 'string' ? data.closingPrayer : undefined,
    chairman: typeof data.chairman === 'string' ? data.chairman : undefined,
    sections: normalizedSections,
    midweekSections: Array.isArray(data.midweekSections)
      ? (data.midweekSections as Meeting['midweekSections'])
      : undefined,
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : undefined,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
    createdAt: (data.createdAt as Meeting['createdAt']) ?? Timestamp.now(),
    updatedAt: (data.updatedAt as Meeting['updatedAt']) ?? Timestamp.now(),
  };
};

const getMeetingTime = (meeting: Meeting): number => {
  const raw: unknown = meeting.meetingDate ?? meeting.startDate;

  if (!raw) return 0;

  if (raw instanceof Date) {
    return raw.getTime();
  }

  if (
    typeof raw === 'object' &&
    raw !== null &&
    'toDate' in raw &&
    typeof (raw as { toDate?: unknown }).toDate === 'function'
  ) {
    return (raw as { toDate: () => Date }).toDate().getTime();
  }

  if (typeof raw === 'string' || typeof raw === 'number') {
    const parsed = new Date(raw).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const sortMeetings = (items: Meeting[]): Meeting[] => {
  return [...items].sort((a, b) => getMeetingTime(a) - getMeetingTime(b));
};

const MEETINGS_RANGE_CACHE_TTL_MS = 60 * 1000;
const MEETING_DOC_CACHE_TTL_MS = 60 * 1000;

const toRangeKey = (startDate: Date, endDate: Date): string =>
  `${startDate.toISOString()}::${endDate.toISOString()}`;

const isInvalidDateRange = (startDate: Date, endDate: Date): boolean =>
  Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate;

const filterByPublicationStatus = (
  meetings: Meeting[],
  publicationStatus?: MeetingPublicationStatus | 'all'
): Meeting[] => {
  if (!publicationStatus || publicationStatus === 'all') {
    return meetings;
  }

  return meetings.filter((meeting) => meeting.publicationStatus === publicationStatus);
};

type MeetingProgramKind = 'midweek' | 'weekend';

const resolveProgramKindFromMeeting = (meeting: Pick<Meeting, 'type' | 'meetingCategory'>): MeetingProgramKind =>
  meeting.type === 'midweek' || meeting.meetingCategory === 'midweek' ? 'midweek' : 'weekend';

const resolveProgramKindFromPayload = (params: {
  type?: MeetingType;
  meetingCategory?: MeetingCategory;
}): MeetingProgramKind =>
  params.type === 'midweek' || params.meetingCategory === 'midweek' ? 'midweek' : 'weekend';

const timestampToDate = (value: unknown): Date | null => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    const converted = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(converted.getTime()) ? null : converted;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const converted = new Date(value);
    return Number.isNaN(converted.getTime()) ? null : converted;
  }

  return null;
};

const startOfToday = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const rangesOverlap = (
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date
): boolean => leftStart <= rightEnd && rightStart <= leftEnd;

const formatShortDate = (value: Date): string =>
  value.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const findMeetingConflictByRange = async (params: {
  congregationId: string;
  meetingType: MeetingProgramKind;
  rangeStart: Date;
  rangeEnd: Date;
  excludeMeetingId?: string;
}): Promise<Meeting | null> => {
  if (isInvalidDateRange(params.rangeStart, params.rangeEnd)) {
    return null;
  }

  const byMeetingDateQuery = query(
    congregationMeetingsCollectionRef(params.congregationId),
    where('meetingDate', '>=', Timestamp.fromDate(params.rangeStart)),
    where('meetingDate', '<=', Timestamp.fromDate(params.rangeEnd)),
    limit(60)
  );

  const byStartDateQuery = query(
    congregationMeetingsCollectionRef(params.congregationId),
    where('startDate', '>=', Timestamp.fromDate(params.rangeStart)),
    where('startDate', '<=', Timestamp.fromDate(params.rangeEnd)),
    limit(60)
  );

  const [meetingDateSnap, startDateSnap] = await Promise.all([
    getDocs(byMeetingDateQuery),
    getDocs(byStartDateQuery),
  ]);

  const byId = new Map<string, Meeting>();
  [...meetingDateSnap.docs, ...startDateSnap.docs].forEach((docSnap) => {
    byId.set(docSnap.id, normalizeMeeting(docSnap.id, docSnap.data()));
  });

  const conflict = Array.from(byId.values()).find((meeting) => {
    if (params.excludeMeetingId && meeting.id === params.excludeMeetingId) {
      return false;
    }

    if (resolveProgramKindFromMeeting(meeting) !== params.meetingType) {
      return false;
    }

    const meetingStart =
      timestampToDate(meeting.startDate) ?? timestampToDate(meeting.meetingDate);
    const meetingEnd =
      timestampToDate(meeting.endDate) ?? meetingStart;

    if (!meetingStart || !meetingEnd) {
      return false;
    }

    return rangesOverlap(
      params.rangeStart,
      params.rangeEnd,
      meetingStart,
      meetingEnd
    );
  });

  return conflict ?? null;
};

/** Obtiene una reunion por ID */
export const getMeetingById = async (
  congregationId: string,
  id: string
): Promise<Meeting | null> => {
  if (!congregationId || typeof congregationId !== 'string' || !id) {
    return null;
  }

  return getDocumentCacheFirst<Meeting>({
    cacheKey: `meetings/${congregationId}/doc/${id}`,
    ref: meetingDocRef(congregationId, id),
    mapSnapshot: (snapshot) =>
      normalizeMeeting(snapshot.id, snapshot.data() as Record<string, unknown>),
    maxAgeMs: MEETING_DOC_CACHE_TTL_MS,
  });
};

/** Obtiene todas las reuniones ordenadas por fecha */
export const getAllMeetings = async (congregationId: string): Promise<Meeting[]> => {
  if (!congregationId || typeof congregationId !== 'string') {
    return [];
  }

  const snap = await getDocs(congregationMeetingsCollectionRef(congregationId));
  return sortMeetings(snap.docs.map((docSnap) => normalizeMeeting(docSnap.id, docSnap.data())));
};

/** Obtiene reuniones del rango visible (semana/rango) con cache-first */
export const getMeetingsByWeek = async (
  congregationId: string,
  startDate: Date,
  endDate: Date,
  options?: {
    forceServer?: boolean;
    includeMidweek?: boolean;
    maxItems?: number;
    publicationStatus?: MeetingPublicationStatus | 'all';
  }
): Promise<Meeting[]> => {
  if (!congregationId || typeof congregationId !== 'string') {
    return [];
  }

  if (isInvalidDateRange(startDate, endDate)) {
    return [];
  }

  const maxItems = options?.maxItems ?? 60;
  const rangeKey = toRangeKey(startDate, endDate);
  const q = query(
    congregationMeetingsCollectionRef(congregationId),
    where('meetingDate', '>=', Timestamp.fromDate(startDate)),
    where('meetingDate', '<=', Timestamp.fromDate(endDate)),
    orderBy('meetingDate', 'asc'),
    limit(maxItems)
  );

  const meetings = await getQueryCacheFirst<Meeting[]>({
    cacheKey: `meetings/${congregationId}/range/${rangeKey}/limit/${maxItems}`,
    query: q,
    maxAgeMs: MEETINGS_RANGE_CACHE_TTL_MS,
    forceServer: options?.forceServer,
    mapSnapshot: (snapshot) =>
      sortMeetings(
        snapshot.docs.map((docSnapshot) =>
          normalizeMeeting(docSnapshot.id, docSnapshot.data())
        )
      ),
  });

  const byStatus = filterByPublicationStatus(meetings, options?.publicationStatus);

  if (options?.includeMidweek) {
    return byStatus;
  }

  return byStatus.filter(
    (meeting) => meeting.meetingCategory !== 'midweek' && meeting.type !== 'midweek'
  );
};

/** Obtiene reuniones por estado */
export const getMeetingsByStatus = async (
  congregationId: string,
  status: MeetingStatus
): Promise<Meeting[]> => {
  const q = query(
    congregationMeetingsCollectionRef(congregationId),
    where('status', '==', status),
    orderBy('meetingDate', 'asc')
  );
  const snap = await getDocs(q);
  return sortMeetings(snap.docs.map((docSnap) => normalizeMeeting(docSnap.id, docSnap.data())));
};

/** Obtiene reuniones donde el usuario es organizador o asistente */
export const getMeetingsByUser = async (
  congregationId: string,
  uid: string
): Promise<Meeting[]> => {
  const meetingsRef = congregationMeetingsCollectionRef(congregationId);

  const [organizerSnap, attendeeSnap] = await Promise.all([
    getDocs(
      query(meetingsRef, where('organizerUid', '==', uid), orderBy('meetingDate', 'asc'))
    ),
    getDocs(
      query(
        meetingsRef,
        where('attendees', 'array-contains', uid),
        orderBy('meetingDate', 'asc')
      )
    ),
  ]);

  const byId = new Map<string, Meeting>();
  [...organizerSnap.docs, ...attendeeSnap.docs].forEach((docSnap) => {
    byId.set(docSnap.id, normalizeMeeting(docSnap.id, docSnap.data()));
  });

  return sortMeetings(Array.from(byId.values()));
};

/** Crea una reunion */
export const createMeeting = async (
  congregationId: string,
  data: CreateMeetingDTO,
  organizerUid: string,
  organizerName: string
): Promise<string> => {
  const meetingCategory: MeetingCategory =
    data.meetingCategory ??
    (data.type === 'midweek' ? 'midweek' : data.type === 'weekend' ? 'weekend' : 'general');
  const normalizedType: MeetingType =
    meetingCategory === 'midweek' ? 'midweek' : data.type;
  const inferredType = normalizedType === 'midweek' ? 'midweek' : 'weekend';
  const meetingRangeStart = timestampToDate(data.startDate);
  const meetingRangeEnd = timestampToDate(data.endDate) ?? meetingRangeStart;

  if (!meetingRangeStart || !meetingRangeEnd) {
    throw new AppError('La reunion debe tener un rango de fechas valido.');
  }

  if (meetingRangeEnd < startOfToday()) {
    throw new AppError('No se pueden crear reuniones con fechas que ya pasaron.');
  }

  let shouldUseManagerFunction = false;
  let duplicatedMeeting: Meeting | null = null;

  try {
    duplicatedMeeting = await findMeetingConflictByRange({
      congregationId,
      meetingType: inferredType,
      rangeStart: meetingRangeStart,
      rangeEnd: meetingRangeEnd,
    });
  } catch (error) {
    if (!isFirebaseErrorCode(error, 'permission-denied')) {
      throw error;
    }

    // Si no se puede leer reuniones desde el cliente, delegamos validacion y escritura al backend.
    shouldUseManagerFunction = true;
  }

  if (duplicatedMeeting) {
    throw new AppError(
      `Ya existe una reunion de ${
        inferredType === 'midweek' ? 'entre semana' : 'fin de semana'
      } para ese rango (${formatShortDate(meetingRangeStart)} al ${formatShortDate(
        meetingRangeEnd
      )}).`
    );
  }

  const normalizedProgram = normalizeMeetingProgramPayload({
    meetingType: inferredType,
    title: data.title,
    description: data.description,
    startDate: data.startDate,
    meetingDate: data.meetingDate,
    sections: data.sections,
    publicationStatus: data.publicationStatus,
    legacyMidweekSections: data.midweekSections,
  });

  const legacyMidweekSections =
    inferredType === 'midweek'
      ? convertProgramSectionsToLegacyMidweekSections(normalizedProgram.sections)
      : undefined;

  const rawPayload: Record<string, unknown> = {
    title: data.title,
    description: data.description,
    type: normalizedType,
    meetingCategory,
    weekLabel: data.weekLabel,
    bibleReading: data.bibleReading,
    startDate: data.startDate,
    endDate: data.endDate,
    meetingDate: normalizedProgram.meetingDate,
    publishedAt: data.publishedAt,
    location: data.location,
    meetingUrl: data.meetingUrl,
    zoomMeetingId: data.zoomMeetingId,
    zoomPasscode: data.zoomPasscode,
    attendees: data.attendees,
    attendeeNames: data.attendeeNames,
    notes: data.notes,
    openingSong: data.openingSong,
    openingPrayer: data.openingPrayer,
    closingSong: data.closingSong,
    closingPrayer: data.closingPrayer,
    chairman: data.chairman,
    publicationStatus: normalizedProgram.publicationStatus,
    sections: normalizedProgram.sections,
    assignedUserIds: normalizedProgram.assignedUserIds,
    searchableText: normalizedProgram.searchableText,
    midweekSections: legacyMidweekSections ?? data.midweekSections ?? null,
    organizerUid,
    organizerName,
    status: data.status ?? ('scheduled' as MeetingStatus),
    createdBy: data.createdBy ?? organizerUid,
    updatedBy: data.updatedBy ?? organizerUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const createViaFunction = async (): Promise<string> => {
    const managerPayload = { ...rawPayload };
    delete managerPayload.createdAt;
    delete managerPayload.updatedAt;

    const meetingId = await createMeetingByManager({
      congregationId,
      meetingData: managerPayload,
    });

    clearSessionCacheByPrefix(`query:meetings/${congregationId}/`);
    return meetingId;
  };

  if (shouldUseManagerFunction) {
    return createViaFunction();
  }

  try {
    const ref = await addDoc(
      congregationMeetingsCollectionRef(congregationId),
      sanitizeForFirestore(rawPayload)
    );

    clearSessionCacheByPrefix(`query:meetings/${congregationId}/`);
    return ref.id;
  } catch (error) {
    if (!isFirebaseErrorCode(error, 'permission-denied')) {
      throw error;
    }

    return createViaFunction();
  }
};

/** Actualiza una reunion */
export const updateMeeting = async (
  congregationId: string,
  id: string,
  data: UpdateMeetingDTO
): Promise<void> => {
  const inferredType =
    data.type === 'midweek' || data.meetingCategory === 'midweek' ? 'midweek' : 'weekend';
  const fallbackStartDate = data.startDate ?? Timestamp.now();

  const normalizedProgram = normalizeMeetingProgramPayload({
    meetingType: inferredType,
    title: data.title ?? 'Reunion',
    description: data.description,
    startDate: fallbackStartDate,
    meetingDate: data.meetingDate,
    sections: data.sections,
    publicationStatus: data.publicationStatus,
    legacyMidweekSections: data.midweekSections,
  });

  const rawPayload: Record<string, unknown> = {
    title: data.title,
    description: data.description,
    type: data.type,
    meetingCategory: data.meetingCategory,
    status: data.status,
    weekLabel: data.weekLabel,
    bibleReading: data.bibleReading,
    startDate: data.startDate,
    endDate: data.endDate,
    meetingDate: normalizedProgram.meetingDate,
    publishedAt: data.publishedAt,
    location: data.location,
    meetingUrl: data.meetingUrl,
    zoomMeetingId: data.zoomMeetingId,
    zoomPasscode: data.zoomPasscode,
    attendees: data.attendees,
    attendeeNames: data.attendeeNames,
    notes: data.notes,
    openingSong: data.openingSong,
    openingPrayer: data.openingPrayer,
    closingSong: data.closingSong,
    closingPrayer: data.closingPrayer,
    chairman: data.chairman,
    publicationStatus: normalizedProgram.publicationStatus,
    sections: normalizedProgram.sections,
    assignedUserIds: normalizedProgram.assignedUserIds,
    searchableText: normalizedProgram.searchableText,
    updatedAt: serverTimestamp(),
  };

  if (inferredType === 'midweek') {
    rawPayload.midweekSections = convertProgramSectionsToLegacyMidweekSections(
      normalizedProgram.sections
    );
  }

  if (typeof data.updatedBy === 'string' && data.updatedBy.trim().length > 0) {
    rawPayload.updatedBy = data.updatedBy;
  }

  const updateRangeStart =
    timestampToDate(data.startDate) ??
    timestampToDate(normalizedProgram.meetingDate);
  const updateRangeEnd = timestampToDate(data.endDate) ?? updateRangeStart;

  let shouldUseManagerFunction = false;

  if (updateRangeStart && updateRangeEnd) {
    try {
      const conflict = await findMeetingConflictByRange({
        congregationId,
        meetingType: inferredType,
        rangeStart: updateRangeStart,
        rangeEnd: updateRangeEnd,
        excludeMeetingId: id,
      });

      if (conflict) {
        throw new AppError(
          `Ya existe otra reunion de ${
            inferredType === 'midweek' ? 'entre semana' : 'fin de semana'
          } para ese rango (${formatShortDate(updateRangeStart)} al ${formatShortDate(
            updateRangeEnd
          )}).`
        );
      }
    } catch (error) {
      if (error instanceof AppError || !isFirebaseErrorCode(error, 'permission-denied')) {
        throw error;
      }

      // Sin permiso de lectura en cliente, delegamos la validacion de conflicto al backend.
      shouldUseManagerFunction = true;
    }
  }

  const payload = sanitizeForFirestore(rawPayload);
  const updateViaFunction = async (): Promise<void> => {
    const managerPayload = { ...rawPayload };
    delete managerPayload.updatedAt;

    await updateMeetingByManager({
      congregationId,
      meetingId: id,
      meetingData: managerPayload,
    });
  };

  if (shouldUseManagerFunction) {
    await updateViaFunction();
    invalidateCacheEntry(`meetings/${congregationId}/doc/${id}`);
    clearSessionCacheByPrefix(`query:meetings/${congregationId}/`);
    return;
  }

  try {
    await updateDoc(meetingDocRef(congregationId, id), payload);
  } catch (error) {
    if (!isFirebaseErrorCode(error, 'permission-denied')) {
      throw error;
    }

    await updateViaFunction();
  }

  invalidateCacheEntry(`meetings/${congregationId}/doc/${id}`);
  clearSessionCacheByPrefix(`query:meetings/${congregationId}/`);
};

/** Elimina una reunion */
export const deleteMeeting = async (
  congregationId: string,
  id: string
): Promise<void> => {
  try {
    await deleteDoc(meetingDocRef(congregationId, id));
  } catch (error) {
    if (!isFirebaseErrorCode(error, 'permission-denied')) {
      throw error;
    }

    await deleteMeetingByManager({
      congregationId,
      meetingId: id,
    });
  }

  invalidateCacheEntry(`meetings/${congregationId}/doc/${id}`);
  clearSessionCacheByPrefix(`query:meetings/${congregationId}/`);
};

/** Cuenta reuniones por estado */
export const getMeetingsCount = async (
  congregationId: string,
  status?: MeetingStatus
): Promise<number> => {
  const meetingsRef = congregationMeetingsCollectionRef(congregationId);
  const q = status ? query(meetingsRef, where('status', '==', status)) : meetingsRef;
  const snap = await getDocs(q);
  return snap.size;
};

/** Suscripcion en tiempo real a todas las reuniones */
export const subscribeToMeetings = (
  congregationId: string,
  callback: (meetings: Meeting[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe => {
  if (!congregationId || typeof congregationId !== 'string') {
    onError?.(new Error('No existe congregationId para cargar reuniones.'));
    return () => {};
  }

  const q = query(congregationMeetingsCollectionRef(congregationId));
  const listenerKey = `meetings:congregation:${congregationId}`;
  logFirestoreListenerCreated(listenerKey);

  const unsubscribe = onSnapshot(
    q,
    (snap) => {
      const meetings = sortMeetings(
        snap.docs.map((docSnap) => normalizeMeeting(docSnap.id, docSnap.data()))
      );
      callback(meetings);
    },
    (error) => {
      console.error('subscribeToMeetings error:', error);
      onError?.(error);
    }
  );

  return () => {
    logFirestoreListenerDestroyed(listenerKey);
    unsubscribe();
  };
};
