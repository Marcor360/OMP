import {
  Timestamp,
  addDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import { congregationMeetingsCollectionRef, meetingDocRef } from '@/src/lib/firebase/refs';
import {
  MIDWEEK_SECTION_IDS,
  MIDWEEK_SECTION_TITLES,
  createBaseMidweekSections,
  normalizeSectionOrder,
  type MidweekAssignment,
  type MidweekMeetingSection,
  type ParticipantAssignment,
} from '@/src/types/midweek-meeting';
import { MeetingStatus } from '@/src/types/meeting';

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
  status: MeetingStatus;
  location?: string;
  meetingUrl?: string;
  notes?: string;
  openingSong?: string;
  openingPrayer?: string;
  closingSong?: string;
  closingPrayer?: string;
  chairman?: string;
  midweekSections: MidweekMeetingSection[];
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
  status?: MeetingStatus;
  location?: string;
  meetingUrl?: string;
  notes?: string;
  openingSong?: string;
  openingPrayer?: string;
  closingSong?: string;
  closingPrayer?: string;
  chairman?: string;
  midweekSections: MidweekMeetingSection[];
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

  const mode = base.mode === 'manual' ? 'manual' : 'user';
  const userId = normalizeText(base.userId);
  const displayName = normalizeText(base.displayName) ?? '';

  return {
    id: normalizeText(base.id) ?? `participant-${index + 1}`,
    mode,
    userId: mode === 'user' ? userId : undefined,
    displayName,
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
    participants: rawParticipants.map((participant, participantIndex) =>
      normalizeParticipant(participant, participantIndex)
    ),
    isOptional: typeof base.isOptional === 'boolean' ? base.isOptional : undefined,
    assignmentType: normalizeText(base.assignmentType) as MidweekAssignment['assignmentType'],
  };
};

const normalizeSections = (value: unknown): MidweekMeetingSection[] => {
  const fallback = createBaseMidweekSections();
  const parsed = Array.isArray(value) ? value : [];

  const byId = new Map<MidweekMeetingSection['id'], MidweekMeetingSection>();

  parsed.forEach((section, index) => {
    const base =
      typeof section === 'object' && section !== null ? (section as Record<string, unknown>) : {};

    const sectionId = normalizeText(base.id) as MidweekMeetingSection['id'];

    if (!MIDWEEK_SECTION_IDS.includes(sectionId)) {
      return;
    }

    const rawItems = Array.isArray(base.items) ? base.items : [];

    byId.set(sectionId, {
      id: sectionId,
      title: normalizeText(base.title) ?? MIDWEEK_SECTION_TITLES[sectionId],
      order: typeof base.order === 'number' ? base.order : index,
      items: rawItems.map((item, itemIndex) => normalizeAssignment(sectionId, item, itemIndex)),
    });
  });

  const completed = MIDWEEK_SECTION_IDS.map((id, index) => {
    const current = byId.get(id);
    const fallbackSection = fallback[index];

    return current ?? fallbackSection;
  });

  return normalizeSectionOrder(completed);
};

const toMidweekMeeting = (
  congregationId: string,
  id: string,
  data: Record<string, unknown>
): MidweekMeeting => {
  const now = Timestamp.now();

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
    status: isMeetingStatus(data.status) ? data.status : 'scheduled',
    location: normalizeText(data.location),
    meetingUrl: normalizeText(data.meetingUrl),
    notes: normalizeText(data.notes),
    openingSong: normalizeText(data.openingSong),
    openingPrayer: normalizeText(data.openingPrayer),
    closingSong: normalizeText(data.closingSong),
    closingPrayer: normalizeText(data.closingPrayer),
    chairman: normalizeText(data.chairman),
    midweekSections: normalizeSections(data.midweekSections),
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

export const createMidweekMeeting = async (
  congregationId: string,
  payload: MidweekMeetingPayload,
  actor: MidweekMeetingActor
): Promise<string> => {
  const normalizedSections = normalizeSections(payload.midweekSections);

  const ref = await addDoc(congregationMeetingsCollectionRef(congregationId), {
    meetingCategory: 'midweek',
    type: 'midweek',
    title: payload.title.trim(),
    description: payload.description?.trim() || null,
    weekLabel: payload.weekLabel.trim(),
    bibleReading: payload.bibleReading.trim(),
    startDate: payload.startDate,
    endDate: payload.endDate,
    status: payload.status ?? ('scheduled' as MeetingStatus),
    location: payload.location?.trim() || null,
    meetingUrl: payload.meetingUrl?.trim() || null,
    notes: payload.notes?.trim() || null,
    openingSong: payload.openingSong?.trim() || null,
    openingPrayer: payload.openingPrayer?.trim() || null,
    closingSong: payload.closingSong?.trim() || null,
    closingPrayer: payload.closingPrayer?.trim() || null,
    chairman: payload.chairman?.trim() || null,
    midweekSections: normalizedSections,
    organizerUid: actor.uid,
    organizerName: actor.displayName,
    attendees: actor.uid ? [actor.uid] : [],
    attendeeNames: payload.attendeeNames?.filter((name) => name.trim().length > 0) ?? [],
    createdBy: actor.uid,
    updatedBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
};

export const updateMidweekMeeting = async (
  congregationId: string,
  meetingId: string,
  payload: MidweekMeetingPayload,
  actorUid?: string
): Promise<void> => {
  const normalizedSections = normalizeSections(payload.midweekSections);

  const updatePayload: Record<string, unknown> = {
    meetingCategory: 'midweek',
    type: 'midweek',
    title: payload.title.trim(),
    description: payload.description?.trim() || null,
    weekLabel: payload.weekLabel.trim(),
    bibleReading: payload.bibleReading.trim(),
    startDate: payload.startDate,
    endDate: payload.endDate,
    status: payload.status ?? ('scheduled' as MeetingStatus),
    location: payload.location?.trim() || null,
    meetingUrl: payload.meetingUrl?.trim() || null,
    notes: payload.notes?.trim() || null,
    openingSong: payload.openingSong?.trim() || null,
    openingPrayer: payload.openingPrayer?.trim() || null,
    closingSong: payload.closingSong?.trim() || null,
    closingPrayer: payload.closingPrayer?.trim() || null,
    chairman: payload.chairman?.trim() || null,
    midweekSections: normalizedSections,
    updatedAt: serverTimestamp(),
  };

  if (actorUid && actorUid.trim().length > 0) {
    updatePayload.updatedBy = actorUid;
  }

  await updateDoc(meetingDocRef(congregationId, meetingId), updatePayload);
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

  return onSnapshot(
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
};
