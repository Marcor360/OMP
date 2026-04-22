import {
  Timestamp,
  addDoc,
  getDoc,
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
import { getQueryCacheFirst } from '@/src/services/repositories/firestore-cache-first';
import { clearSessionCacheByPrefix } from '@/src/services/repositories/session-cache';
import {
  createMeetingByManager,
  updateMeetingByManager,
} from '@/src/services/meetings/manager-meetings-service';
import {
  MIDWEEK_KNOWN_SECTION_IDS,
  MIDWEEK_REQUIRED_SECTION_IDS,
  MIDWEEK_SECTION_TITLES,
  createBaseMidweekSections,
  normalizeSectionOrder,
  type MidweekAssignment,
  type MidweekMeetingSection,
  type ParticipantAssignment,
} from '@/src/types/midweek-meeting';
import { MeetingStatus } from '@/src/types/meeting';
import { MeetingProgramSection, MeetingPublicationStatus } from '@/src/types/meeting/program';

import {
  convertProgramSectionsToLegacyMidweekSections,
  normalizeMeetingProgramPayload,
} from '@/src/services/meetings/meeting-program-utils';
import { sanitizeForFirestore } from '@/src/services/meetings/firestore-payload';

type MidweekMeetingCategory = 'midweek';
type MidweekMeetingType = 'midweek';

export interface MidweekMeeting {
  id: string;
  congregationId: string;
  meetingCategory: MidweekMeetingCategory;
  type: MidweekMeetingType;
  title: string;
  description?: string;
  weekLabel: string;
  bibleReading: string;
  startDate: Timestamp;
  endDate: Timestamp;
  meetingDate?: Timestamp;
  status: MeetingStatus;
  publicationStatus?: MeetingPublicationStatus;
  publishedAt?: Timestamp;
  location?: string;
  meetingUrl?: string;
  zoomMeetingId?: string;
  zoomPasscode?: string;
  notes?: string;
  openingSong?: string;
  openingPrayer?: string;
  middleSong?: string;
  closingSong?: string;
  closingPrayer?: string;
  chairman?: string;
  midweekSections: MidweekMeetingSection[];
  sections?: MeetingProgramSection[];
  assignedUserIds?: string[];
  searchableText?: string;
  organizerUid: string;
  organizerName: string;
  attendees: string[];
  attendeeNames?: string[];
  createdBy?: string;
  updatedBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MidweekMeetingPayload {
  title: string;
  description?: string;
  weekLabel: string;
  bibleReading: string;
  startDate: Timestamp;
  endDate: Timestamp;
  meetingDate?: Timestamp;
  status?: MeetingStatus;
  publicationStatus?: MeetingPublicationStatus;
  publishedAt?: Timestamp;
  location?: string;
  meetingUrl?: string;
  zoomMeetingId?: string;
  zoomPasscode?: string;
  notes?: string;
  openingSong?: string;
  openingPrayer?: string;
  middleSong?: string;
  closingSong?: string;
  closingPrayer?: string;
  chairman?: string;
  midweekSections: MidweekMeetingSection[];
  sections?: MeetingProgramSection[];
  assignedUserIds?: string[];
  searchableText?: string;
  attendeeNames?: string[];
}

export interface MidweekMeetingActor {
  uid: string;
  displayName: string;
}

const isMeetingStatus = (value: unknown): value is MeetingStatus =>
  value === 'pending' ||
  value === 'scheduled' ||
  value === 'in_progress' ||
  value === 'completed' ||
  value === 'cancelled';

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeTimestamp = (value: unknown, fallback: Timestamp): Timestamp => {
  if (value instanceof Timestamp) return value;

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    return Timestamp.fromDate((value as { toDate: () => Date }).toDate());
  }

  if (value instanceof Date) {
    return Timestamp.fromDate(value);
  }

  return fallback;
};

const normalizeParticipant = (value: unknown, index: number): ParticipantAssignment => {
  const base = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

  const mode =
    base.mode === 'manual' || base.mode === 'specialRole' ? base.mode : 'user';
  const userId = normalizeText(base.userId);
  const displayName = normalizeText(base.displayName) ?? '';

  return {
    id: normalizeText(base.id) ?? `participant-${index + 1}`,
    mode,
    userId: mode === 'user' ? userId : undefined,
    displayName,
    specialRoleKey:
      mode === 'specialRole' && base.specialRoleKey === 'circuitOverseer'
        ? 'circuitOverseer'
        : undefined,
    roleLabel: normalizeText(base.roleLabel),
    gender: normalizeText(base.gender),
    isAssistant: typeof base.isAssistant === 'boolean' ? base.isAssistant : undefined,
  };
};

const normalizeAssignment = (
  sectionId: MidweekMeetingSection['id'],
  value: unknown,
  index: number
): MidweekAssignment => {
  const base = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const rawParticipants = Array.isArray(base.participants) ? base.participants : [];

  const durationRaw = base.durationMinutes;
  const durationMinutes =
    typeof durationRaw === 'number' && Number.isFinite(durationRaw) ? durationRaw : undefined;

  return {
    id: normalizeText(base.id) ?? `assignment-${index + 1}`,
    sectionId,
    order: typeof base.order === 'number' && Number.isFinite(base.order) ? base.order : index,
    title: normalizeText(base.title) ?? '',
    theme: normalizeText(base.theme),
    durationMinutes,
    notes: normalizeText(base.notes),
    roomKey: normalizeText(base.roomKey),
    startTime: normalizeText(base.startTime),
    endTime: normalizeText(base.endTime),
    assignmentScope:
      base.assignmentScope === 'internal' || base.assignmentScope === 'informational'
        ? base.assignmentScope
        : 'internal',
    participants: rawParticipants.map((participant, participantIndex) =>
      normalizeParticipant(participant, participantIndex)
    ),
    isOptional: typeof base.isOptional === 'boolean' ? base.isOptional : undefined,
    assignmentType: normalizeText(base.assignmentType) as MidweekAssignment['assignmentType'],
    allowCircuitOverseerOption: base.allowCircuitOverseerOption === true,
  };
};

const normalizeSections = (value: unknown): MidweekMeetingSection[] => {
  const fallback = createBaseMidweekSections();
  const parsed = Array.isArray(value) ? value : [];

  const byId = new Map<MidweekMeetingSection['id'], MidweekMeetingSection>();

  parsed.forEach((section, index) => {
    const base =
      typeof section === 'object' && section !== null ? (section as Record<string, unknown>) : {};

    const sectionIdRaw = normalizeText(base.id);
    if (!sectionIdRaw) {
      return;
    }
    const sectionId = sectionIdRaw as MidweekMeetingSection['id'];
    const isKnown = MIDWEEK_KNOWN_SECTION_IDS.includes(sectionId);
    const isDynamic = sectionId.startsWith('dynamic-');

    if (!isKnown && !isDynamic) {
      return;
    }

    const rawItems = Array.isArray(base.items) ? base.items : [];

    byId.set(sectionId, {
      id: sectionId,
      title:
        normalizeText(base.title) ??
        MIDWEEK_SECTION_TITLES[sectionId] ??
        `Seccion ${index + 1}`,
      order: typeof base.order === 'number' ? base.order : index,
      sectionType:
        base.sectionType === 'predefined' ||
        base.sectionType === 'dynamic' ||
        base.sectionType === 'special'
          ? base.sectionType
          : isDynamic
            ? 'dynamic'
            : 'predefined',
      isRequired: MIDWEEK_REQUIRED_SECTION_IDS.includes(sectionId),
      isEnabled: base.isEnabled !== false,
      colorToken:
        base.colorToken === 'blue' ||
        base.colorToken === 'indigo' ||
        base.colorToken === 'orange' ||
        base.colorToken === 'red' ||
        base.colorToken === 'green' ||
        base.colorToken === 'teal' ||
        base.colorToken === 'dark'
          ? base.colorToken
          : undefined,
      items: rawItems.map((item, itemIndex) => normalizeAssignment(sectionId, item, itemIndex)),
    });
  });

  const completed = MIDWEEK_KNOWN_SECTION_IDS.map((id, index) => {
    const current = byId.get(id);
    const fallbackSection = fallback[index];

    return current ?? fallbackSection;
  });

  byId.forEach((section, sectionId) => {
    const isKnown = MIDWEEK_KNOWN_SECTION_IDS.includes(sectionId);
    if (!isKnown) {
      completed.push(section);
    }
  });

  return normalizeSectionOrder(completed);
};

const toMidweekMeeting = (
  congregationId: string,
  id: string,
  data: Record<string, unknown>
): MidweekMeeting => {
  const now = Timestamp.now();
  const midweekSections = normalizeSections(data.midweekSections);
  const normalizedProgram = normalizeMeetingProgramPayload({
    meetingType: 'midweek',
    title: normalizeText(data.title) ?? 'Reunion de entre semana',
    description: normalizeText(data.description),
    startDate: normalizeTimestamp(data.startDate, now),
    meetingDate: normalizeTimestamp(data.meetingDate, normalizeTimestamp(data.startDate, now)),
    sections: data.sections,
    publicationStatus:
      data.publicationStatus === 'draft' || data.publicationStatus === 'published'
        ? data.publicationStatus
        : undefined,
    legacyMidweekSections: midweekSections,
  });

  return {
    id,
    congregationId,
    meetingCategory: 'midweek',
    type: 'midweek',
    title: normalizeText(data.title) ?? 'Reunion de entre semana',
    description: normalizeText(data.description),
    weekLabel: normalizeText(data.weekLabel) ?? '',
    bibleReading: normalizeText(data.bibleReading) ?? '',
    startDate: normalizeTimestamp(data.startDate, now),
    endDate: normalizeTimestamp(data.endDate, now),
    meetingDate: normalizedProgram.meetingDate,
    status: isMeetingStatus(data.status) ? data.status : 'scheduled',
    publicationStatus: normalizedProgram.publicationStatus,
    publishedAt:
      data.publishedAt instanceof Timestamp
        ? data.publishedAt
        : undefined,
    location: normalizeText(data.location),
    meetingUrl: normalizeText(data.meetingUrl),
    zoomMeetingId: normalizeText(data.zoomMeetingId),
    zoomPasscode: normalizeText(data.zoomPasscode),
    notes: normalizeText(data.notes),
    openingSong: normalizeText(data.openingSong),
    openingPrayer: normalizeText(data.openingPrayer),
    middleSong: normalizeText(data.middleSong),
    closingSong: normalizeText(data.closingSong),
    closingPrayer: normalizeText(data.closingPrayer),
    chairman: normalizeText(data.chairman),
    midweekSections,
    sections: normalizedProgram.sections,
    assignedUserIds: normalizedProgram.assignedUserIds,
    searchableText: normalizedProgram.searchableText,
    organizerUid: normalizeText(data.organizerUid) ?? '',
    organizerName: normalizeText(data.organizerName) ?? 'Sistema',
    attendees: Array.isArray(data.attendees)
      ? data.attendees.filter((item): item is string => typeof item === 'string')
      : [],
    attendeeNames: Array.isArray(data.attendeeNames)
      ? data.attendeeNames.filter((item): item is string => typeof item === 'string')
      : undefined,
    createdBy: normalizeText(data.createdBy),
    updatedBy: normalizeText(data.updatedBy),
    createdAt: normalizeTimestamp(data.createdAt, now),
    updatedAt: normalizeTimestamp(data.updatedAt, now),
  };
};

const sortByStartDateDesc = (items: MidweekMeeting[]): MidweekMeeting[] =>
  [...items].sort((left, right) => right.startDate.toMillis() - left.startDate.toMillis());

const MIDWEEK_RANGE_CACHE_TTL_MS = 60 * 1000;

const buildRangeKey = (startDate: Date, endDate: Date): string =>
  `${startDate.toISOString()}::${endDate.toISOString()}`;

const isInvalidRange = (startDate: Date, endDate: Date): boolean =>
  Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate;

export const getMidweekMeetingById = async (
  congregationId: string,
  meetingId: string
): Promise<MidweekMeeting | null> => {
  const snap = await getDoc(meetingDocRef(congregationId, meetingId));

  if (!snap.exists()) return null;

  const data = snap.data();
  const category = normalizeText(data.meetingCategory);
  const type = normalizeText(data.type);

  if (category !== 'midweek' && type !== 'midweek') {
    return null;
  }

  return toMidweekMeeting(congregationId, snap.id, data);
};

export const getMidweekMeetings = async (congregationId: string): Promise<MidweekMeeting[]> => {
  if (!congregationId || typeof congregationId !== 'string') {
    return [];
  }

  const q = query(
    congregationMeetingsCollectionRef(congregationId),
    where('meetingCategory', '==', 'midweek')
  );

  const snap = await getDocs(q);

  return sortByStartDateDesc(snap.docs.map((docSnap) => toMidweekMeeting(congregationId, docSnap.id, docSnap.data())));
};

export const getMidweekMeetingsByWeek = async (
  congregationId: string,
  startDate: Date,
  endDate: Date,
  options?: { forceServer?: boolean; maxItems?: number }
): Promise<MidweekMeeting[]> => {
  if (!congregationId || typeof congregationId !== 'string') {
    return [];
  }

  if (isInvalidRange(startDate, endDate)) {
    return [];
  }

  const maxItems = options?.maxItems ?? 50;
  const cacheKey = `midweek/${congregationId}/range/${buildRangeKey(startDate, endDate)}/limit/${maxItems}`;

  const q = query(
    congregationMeetingsCollectionRef(congregationId),
    where('meetingCategory', '==', 'midweek'),
    where('startDate', '>=', Timestamp.fromDate(startDate)),
    where('startDate', '<=', Timestamp.fromDate(endDate)),
    orderBy('startDate', 'desc'),
    limit(maxItems)
  );

  try {
    return await getQueryCacheFirst<MidweekMeeting[]>({
      cacheKey,
      query: q,
      forceServer: options?.forceServer,
      maxAgeMs: MIDWEEK_RANGE_CACHE_TTL_MS,
      mapSnapshot: (snapshot) =>
        sortByStartDateDesc(
          snapshot.docs.map((docSnap) => toMidweekMeeting(congregationId, docSnap.id, docSnap.data()))
        ),
    });
  } catch {
    const fallbackQuery = query(
      congregationMeetingsCollectionRef(congregationId),
      where('meetingCategory', '==', 'midweek'),
      orderBy('startDate', 'desc'),
      limit(maxItems * 2)
    );

    const fallback = await getQueryCacheFirst<MidweekMeeting[]>({
      cacheKey: `${cacheKey}/fallback`,
      query: fallbackQuery,
      forceServer: options?.forceServer,
      maxAgeMs: MIDWEEK_RANGE_CACHE_TTL_MS,
      mapSnapshot: (snapshot) =>
        sortByStartDateDesc(
          snapshot.docs.map((docSnap) => toMidweekMeeting(congregationId, docSnap.id, docSnap.data()))
        ),
    });

    const startMillis = Timestamp.fromDate(startDate).toMillis();
    const endMillis = Timestamp.fromDate(endDate).toMillis();

    return fallback.filter((meeting) => {
      const millis = meeting.startDate.toMillis();
      return millis >= startMillis && millis <= endMillis;
    });
  }
};

export const createMidweekMeeting = async (
  congregationId: string,
  payload: MidweekMeetingPayload,
  actor: MidweekMeetingActor
): Promise<string> => {
  const normalizedProgram = normalizeMeetingProgramPayload({
    meetingType: 'midweek',
    title: payload.title,
    description: payload.description,
    startDate: payload.startDate,
    meetingDate: payload.meetingDate,
    sections: payload.sections,
    publicationStatus: payload.publicationStatus,
    legacyMidweekSections: payload.midweekSections,
  });
  const normalizedSections = convertProgramSectionsToLegacyMidweekSections(
    normalizedProgram.sections
  );

  const rawPayload: Record<string, unknown> = {
    meetingCategory: 'midweek',
    type: 'midweek',
    title: payload.title.trim(),
    description: payload.description?.trim() || null,
    weekLabel: payload.weekLabel.trim(),
    bibleReading: payload.bibleReading.trim(),
    startDate: payload.startDate,
    endDate: payload.endDate,
    meetingDate: normalizedProgram.meetingDate,
    status: payload.status ?? ('scheduled' as MeetingStatus),
    publicationStatus: normalizedProgram.publicationStatus,
    publishedAt: payload.publishedAt ?? null,
    location: payload.location?.trim() || null,
    meetingUrl: payload.meetingUrl?.trim() || null,
    zoomMeetingId: payload.zoomMeetingId?.trim() || null,
    zoomPasscode: payload.zoomPasscode?.trim() || null,
    notes: payload.notes?.trim() || null,
    openingSong: payload.openingSong?.trim() || null,
    openingPrayer: payload.openingPrayer?.trim() || null,
    middleSong: payload.middleSong?.trim() || null,
    closingSong: payload.closingSong?.trim() || null,
    closingPrayer: payload.closingPrayer?.trim() || null,
    chairman: payload.chairman?.trim() || null,
    sections: normalizedProgram.sections,
    midweekSections: normalizedSections,
    assignedUserIds: normalizedProgram.assignedUserIds,
    searchableText: normalizedProgram.searchableText,
    organizerUid: actor.uid,
    organizerName: actor.displayName,
    attendees: actor.uid ? [actor.uid] : [],
    attendeeNames: payload.attendeeNames?.filter((name) => name.trim().length > 0) ?? [],
    createdBy: actor.uid,
    updatedBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const createViaFunction = async (): Promise<string> => {
    const managerPayload = { ...rawPayload };
    delete managerPayload.createdAt;
    delete managerPayload.updatedAt;

    return createMeetingByManager({
      congregationId,
      meetingData: managerPayload,
    });
  };

  let meetingId: string;
  try {
    const ref = await addDoc(
      congregationMeetingsCollectionRef(congregationId),
      sanitizeForFirestore(rawPayload)
    );
    meetingId = ref.id;
  } catch (error) {
    if (!isFirebaseErrorCode(error, 'permission-denied')) {
      throw error;
    }

    meetingId = await createViaFunction();
  }

  clearSessionCacheByPrefix(`query:midweek/${congregationId}/`);
  clearSessionCacheByPrefix(`query:meetings/${congregationId}/`);
  return meetingId;
};

export const updateMidweekMeeting = async (
  congregationId: string,
  meetingId: string,
  payload: MidweekMeetingPayload,
  actorUid?: string
): Promise<void> => {
  const normalizedProgram = normalizeMeetingProgramPayload({
    meetingType: 'midweek',
    title: payload.title,
    description: payload.description,
    startDate: payload.startDate,
    meetingDate: payload.meetingDate,
    sections: payload.sections,
    publicationStatus: payload.publicationStatus,
    legacyMidweekSections: payload.midweekSections,
  });
  const normalizedSections = convertProgramSectionsToLegacyMidweekSections(
    normalizedProgram.sections
  );

  const rawUpdatePayload: Record<string, unknown> = {
    meetingCategory: 'midweek',
    type: 'midweek',
    title: payload.title.trim(),
    description: payload.description?.trim() || null,
    weekLabel: payload.weekLabel.trim(),
    bibleReading: payload.bibleReading.trim(),
    startDate: payload.startDate,
    endDate: payload.endDate,
    meetingDate: normalizedProgram.meetingDate,
    status: payload.status ?? ('scheduled' as MeetingStatus),
    publicationStatus: normalizedProgram.publicationStatus,
    publishedAt: payload.publishedAt ?? null,
    location: payload.location?.trim() || null,
    meetingUrl: payload.meetingUrl?.trim() || null,
    zoomMeetingId: payload.zoomMeetingId?.trim() || null,
    zoomPasscode: payload.zoomPasscode?.trim() || null,
    notes: payload.notes?.trim() || null,
    openingSong: payload.openingSong?.trim() || null,
    openingPrayer: payload.openingPrayer?.trim() || null,
    middleSong: payload.middleSong?.trim() || null,
    closingSong: payload.closingSong?.trim() || null,
    closingPrayer: payload.closingPrayer?.trim() || null,
    chairman: payload.chairman?.trim() || null,
    sections: normalizedProgram.sections,
    midweekSections: normalizedSections,
    assignedUserIds: normalizedProgram.assignedUserIds,
    searchableText: normalizedProgram.searchableText,
    updatedAt: serverTimestamp(),
  };

  if (actorUid && actorUid.trim().length > 0) {
    rawUpdatePayload.updatedBy = actorUid;
  }

  const updatePayload = sanitizeForFirestore(rawUpdatePayload);

  const updateViaFunction = async (): Promise<void> => {
    const managerPayload = { ...rawUpdatePayload };
    delete managerPayload.updatedAt;

    await updateMeetingByManager({
      congregationId,
      meetingId,
      meetingData: managerPayload,
    });
  };

  try {
    await updateDoc(meetingDocRef(congregationId, meetingId), updatePayload);
  } catch (error) {
    if (!isFirebaseErrorCode(error, 'permission-denied')) {
      throw error;
    }

    await updateViaFunction();
  }
  clearSessionCacheByPrefix(`query:midweek/${congregationId}/`);
  clearSessionCacheByPrefix(`query:meetings/${congregationId}/`);
};

export const subscribeToMidweekMeetings = (
  congregationId: string,
  callback: (meetings: MidweekMeeting[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe => {
  if (!congregationId || typeof congregationId !== 'string') {
    onError?.(new Error('No existe congregationId para cargar reuniones de entre semana.'));
    return () => {};
  }

  const q = query(
    congregationMeetingsCollectionRef(congregationId),
    where('meetingCategory', '==', 'midweek')
  );
  const listenerKey = `midweek:congregation:${congregationId}`;
  logFirestoreListenerCreated(listenerKey);

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const meetings = sortByStartDateDesc(
        snapshot.docs.map((docSnap) => toMidweekMeeting(congregationId, docSnap.id, docSnap.data()))
      );

      callback(meetings);
    },
    (error) => {
      console.error('subscribeToMidweekMeetings error:', error);
      onError?.(error);
    }
  );

  return () => {
    logFirestoreListenerDestroyed(listenerKey);
    unsubscribe();
  };
};

