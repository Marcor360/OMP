import { Timestamp } from 'firebase/firestore';

import type {
  Meeting,
  MeetingCategory,
  MeetingCleaningAssignmentMode,
  MeetingType,
} from '@/src/types/meeting';
import {
  buildMeetingSearchableText,
  collectAssignedUserIds,
  createDefaultSectionsForMeetingType,
  type MeetingPublicationStatus,
  normalizeMeetingSections,
} from '@/src/types/meeting/program';
import {
  convertLegacyMidweekSectionsToProgramSections,
} from '@/src/services/meetings/meeting-program-utils';

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
  value === 'draft' || value === 'awaiting_assignments' || value === 'published';

const isCleaningAssignmentMode = (value: unknown): value is MeetingCleaningAssignmentMode =>
  value === 'none' || value === 'selected' || value === 'all';

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0
  );
};

export const normalizeMeeting = (id: string, data: Record<string, unknown>): Meeting => {
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
    cleaningAssignmentMode: isCleaningAssignmentMode(data.cleaningAssignmentMode)
      ? data.cleaningAssignmentMode
      : 'none',
    cleaningGroupIds: toStringArray(data.cleaningGroupIds),
    cleaningGroupNames: toStringArray(data.cleaningGroupNames),
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

export const timestampToDate = (value: unknown): Date | null => {
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

export const createCurrentMeetingTimestamp = (): Meeting['startDate'] => Timestamp.now();

const getMeetingTime = (meeting: Meeting): number => {
  const raw: unknown = meeting.meetingDate ?? meeting.startDate;

  if (!raw) return 0;

  const asDate = timestampToDate(raw);
  return asDate ? asDate.getTime() : 0;
};

export const sortMeetings = (items: Meeting[]): Meeting[] => {
  return [...items].sort((a, b) => getMeetingTime(a) - getMeetingTime(b));
};
