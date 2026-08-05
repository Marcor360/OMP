import { Timestamp } from 'firebase/firestore';

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
import type { MeetingStatus } from '@/src/types/meeting';
import type {
  MeetingProgramSection,
  MeetingPublicationStatus,
} from '@/src/types/meeting/program';
import {
  normalizeMeetingProgramPayload,
} from '@/src/services/meetings/meeting-program-utils';

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

const isMeetingStatus = (value: unknown): value is MeetingStatus =>
  value === 'pending' ||
  value === 'scheduled' ||
  value === 'in_progress' ||
  value === 'completed' ||
  value === 'cancelled';

export const normalizeMidweekText = (value: unknown): string | undefined => {
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
  const userId = normalizeMidweekText(base.userId);
  const displayName = normalizeMidweekText(base.displayName) ?? '';

  return {
    id: normalizeMidweekText(base.id) ?? `participant-${index + 1}`,
    mode,
    userId: mode === 'user' ? userId : undefined,
    displayName,
    specialRoleKey:
      mode === 'specialRole' && base.specialRoleKey === 'circuitOverseer'
        ? 'circuitOverseer'
        : undefined,
    roleLabel: normalizeMidweekText(base.roleLabel),
    gender: normalizeMidweekText(base.gender),
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
    id: normalizeMidweekText(base.id) ?? `assignment-${index + 1}`,
    sectionId,
    order: typeof base.order === 'number' && Number.isFinite(base.order) ? base.order : index,
    title: normalizeMidweekText(base.title) ?? '',
    theme: normalizeMidweekText(base.theme),
    durationMinutes,
    notes: normalizeMidweekText(base.notes),
    roomKey: normalizeMidweekText(base.roomKey),
    startTime: normalizeMidweekText(base.startTime),
    endTime: normalizeMidweekText(base.endTime),
    assignmentScope:
      base.assignmentScope === 'internal' || base.assignmentScope === 'informational'
        ? base.assignmentScope
        : 'internal',
    participants: rawParticipants.map((participant, participantIndex) =>
      normalizeParticipant(participant, participantIndex)
    ),
    isOptional: typeof base.isOptional === 'boolean' ? base.isOptional : undefined,
    assignmentType: normalizeMidweekText(base.assignmentType) as MidweekAssignment['assignmentType'],
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

    const sectionIdRaw = normalizeMidweekText(base.id);
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
        normalizeMidweekText(base.title) ??
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

export const toMidweekMeeting = (
  congregationId: string,
  id: string,
  data: Record<string, unknown>
): MidweekMeeting => {
  const now = Timestamp.now();
  const midweekSections = normalizeSections(data.midweekSections);
  const normalizedProgram = normalizeMeetingProgramPayload({
    meetingType: 'midweek',
    title: normalizeMidweekText(data.title) ?? 'Reunion de entre semana',
    description: normalizeMidweekText(data.description),
    startDate: normalizeTimestamp(data.startDate, now),
    meetingDate: normalizeTimestamp(data.meetingDate, normalizeTimestamp(data.startDate, now)),
    sections: data.sections,
    publicationStatus:
      data.publicationStatus === 'draft' ||
      data.publicationStatus === 'awaiting_assignments' ||
      data.publicationStatus === 'published'
        ? data.publicationStatus
        : undefined,
    legacyMidweekSections: midweekSections,
  });

  return {
    id,
    congregationId,
    meetingCategory: 'midweek',
    type: 'midweek',
    title: normalizeMidweekText(data.title) ?? 'Reunion de entre semana',
    description: normalizeMidweekText(data.description),
    weekLabel: normalizeMidweekText(data.weekLabel) ?? '',
    bibleReading: normalizeMidweekText(data.bibleReading) ?? '',
    startDate: normalizeTimestamp(data.startDate, now),
    endDate: normalizeTimestamp(data.endDate, now),
    meetingDate: normalizedProgram.meetingDate,
    status: isMeetingStatus(data.status) ? data.status : 'scheduled',
    publicationStatus: normalizedProgram.publicationStatus,
    publishedAt:
      data.publishedAt instanceof Timestamp
        ? data.publishedAt
        : undefined,
    location: normalizeMidweekText(data.location),
    meetingUrl: normalizeMidweekText(data.meetingUrl),
    zoomMeetingId: normalizeMidweekText(data.zoomMeetingId),
    zoomPasscode: normalizeMidweekText(data.zoomPasscode),
    notes: normalizeMidweekText(data.notes),
    openingSong: normalizeMidweekText(data.openingSong),
    openingPrayer: normalizeMidweekText(data.openingPrayer),
    middleSong: normalizeMidweekText(data.middleSong),
    closingSong: normalizeMidweekText(data.closingSong),
    closingPrayer: normalizeMidweekText(data.closingPrayer),
    chairman: normalizeMidweekText(data.chairman),
    midweekSections,
    sections: normalizedProgram.sections,
    assignedUserIds: normalizedProgram.assignedUserIds,
    searchableText: normalizedProgram.searchableText,
    organizerUid: normalizeMidweekText(data.organizerUid) ?? '',
    organizerName: normalizeMidweekText(data.organizerName) ?? 'Sistema',
    attendees: Array.isArray(data.attendees)
      ? data.attendees.filter((item): item is string => typeof item === 'string')
      : [],
    attendeeNames: Array.isArray(data.attendeeNames)
      ? data.attendeeNames.filter((item): item is string => typeof item === 'string')
      : undefined,
    createdBy: normalizeMidweekText(data.createdBy),
    updatedBy: normalizeMidweekText(data.updatedBy),
    createdAt: normalizeTimestamp(data.createdAt, now),
    updatedAt: normalizeTimestamp(data.updatedAt, now),
  };
};

export const sortMidweekMeetingsByStartDateDesc = (
  items: MidweekMeeting[]
): MidweekMeeting[] =>
  [...items].sort((left, right) => right.startDate.toMillis() - left.startDate.toMillis());
