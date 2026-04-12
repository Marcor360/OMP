import { Timestamp } from 'firebase/firestore';

import {
  Assignment,
  AssignmentCategory,
  AssignmentMeetingType,
  AssignmentPerson,
  AssignmentStatus,
  AssignmentSubType,
} from '@/src/modules/assignments/types/assignment.types';

type RawDocData = Record<string, unknown>;

interface MeetingContext {
  id: string;
  congregationId: string;
  type?: unknown;
  startDate?: unknown;
}

const isCategory = (value: unknown): value is AssignmentCategory =>
  value === 'midweek' ||
  value === 'weekend' ||
  value === 'cleaning' ||
  value === 'hospitality';

const isSubType = (value: unknown): value is Exclude<AssignmentSubType, null> =>
  value === 'microphone' || value === 'platform';

const isMeetingType = (value: unknown): value is Exclude<AssignmentMeetingType, null> =>
  value === 'midweek' || value === 'weekend';

const isStatus = (value: unknown): value is AssignmentStatus =>
  value === 'pending' ||
  value === 'assigned' ||
  value === 'in_progress' ||
  value === 'completed' ||
  value === 'cancelled' ||
  value === 'overdue';

const coerceString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toDate = (value: unknown): Date | null => {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (typeof value === 'number') {
    const fromMillis = new Date(value);
    if (!Number.isNaN(fromMillis.getTime())) return fromMillis;
    return null;
  }

  if (typeof value === 'string') {
    const fromString = new Date(value);
    if (!Number.isNaN(fromString.getTime())) return fromString;
  }

  return null;
};

const toIso = (value: unknown): string | undefined => {
  const parsed = toDate(value);
  return parsed ? parsed.toISOString() : undefined;
};

const normalizeAssignedUsers = (data: RawDocData): AssignmentPerson[] => {
  const raw = data.assignedUsers;

  if (Array.isArray(raw)) {
    const users = raw
      .map((item) => {
        if (!item || typeof item !== 'object') return null;

        const record = item as Record<string, unknown>;
        const name = coerceString(record.name);
        if (!name) return null;

        const user: AssignmentPerson = {
          userId: coerceString(record.userId),
          name,
        };

        return user;
      })
      .filter((item): item is AssignmentPerson => item !== null);

    if (users.length > 0) {
      return users;
    }
  }

  const assignedToName = coerceString(data.assignedToName);
  if (!assignedToName) return [];

  return [
    {
      userId: coerceString(data.assignedToUid),
      name: assignedToName,
    },
  ];
};

const normalizeCategory = (
  data: RawDocData,
  meetingTypeHint: AssignmentMeetingType
): AssignmentCategory => {
  if (isCategory(data.category)) {
    return data.category;
  }

  const notes = `${coerceString(data.notes) ?? ''} ${coerceString(data.title) ?? ''}`.toLowerCase();

  if (notes.includes('limpieza')) {
    return 'cleaning';
  }

  if (notes.includes('hospitalidad')) {
    return 'hospitality';
  }

  if (meetingTypeHint === 'midweek') {
    return 'midweek';
  }

  return 'weekend';
};

const normalizeMeetingType = (
  data: RawDocData,
  meetingTypeHint: AssignmentMeetingType,
  category: AssignmentCategory
): AssignmentMeetingType => {
  if (category === 'cleaning' || category === 'hospitality') {
    return null;
  }

  if (isMeetingType(data.meetingType)) {
    return data.meetingType;
  }

  if (isMeetingType(data.type)) {
    return data.type;
  }

  if (meetingTypeHint) {
    return meetingTypeHint;
  }

  return category === 'midweek' ? 'midweek' : 'weekend';
};

const normalizeSubType = (data: RawDocData, category: AssignmentCategory): AssignmentSubType => {
  if (category === 'cleaning' || category === 'hospitality') {
    return null;
  }

  if (isSubType(data.subType)) {
    return data.subType;
  }

  const tags = Array.isArray(data.tags)
    ? data.tags
        .map((item) => (typeof item === 'string' ? item.toLowerCase() : ''))
        .filter((item) => item.length > 0)
    : [];

  if (tags.some((tag) => tag.includes('micro'))) {
    return 'microphone';
  }

  if (tags.some((tag) => tag.includes('plataform'))) {
    return 'platform';
  }

  return null;
};

const normalizeStatus = (data: RawDocData): AssignmentStatus | undefined => {
  if (isStatus(data.status)) {
    return data.status;
  }

  return undefined;
};

export const buildAssignmentSourceKey = (
  source: 'meeting' | 'congregation',
  id: string,
  meetingId?: string
): string => `${source}:${meetingId ?? 'none'}:${id}`;

const mapBaseAssignment = (
  id: string,
  source: 'meeting' | 'congregation',
  congregationId: string,
  data: RawDocData,
  meetingTypeHint: AssignmentMeetingType,
  meetingId?: string,
  meetingStartDate?: unknown
): Assignment => {
  const dateIso =
    toIso(data.date) ??
    toIso(data.dueDate) ??
    toIso(meetingStartDate) ??
    toIso(data.createdAt) ??
    new Date().toISOString();

  const category = normalizeCategory(data, meetingTypeHint);
  const meetingType = normalizeMeetingType(data, meetingTypeHint, category);
  const subType = normalizeSubType(data, category);

  return {
    id,
    source,
    sourceKey: buildAssignmentSourceKey(source, id, meetingId),
    congregationId,
    meetingId,
    category,
    subType,
    meetingType,
    date: dateIso,
    assignedUsers: normalizeAssignedUsers(data),
    notes: coerceString(data.notes) ?? coerceString(data.description),
    status: normalizeStatus(data),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    title: coerceString(data.title),
  };
};

export const mapAssignmentFromMeetingDoc = (
  id: string,
  data: RawDocData,
  meeting: MeetingContext
): Assignment => {
  const meetingTypeHint: AssignmentMeetingType =
    meeting.type === 'midweek' ? 'midweek' : 'weekend';

  return mapBaseAssignment(
    id,
    'meeting',
    meeting.congregationId,
    data,
    meetingTypeHint,
    meeting.id,
    meeting.startDate
  );
};

export const mapAssignmentFromCongregationDoc = (
  id: string,
  data: RawDocData,
  congregationId: string
): Assignment => {
  const meetingTypeHint: AssignmentMeetingType = isMeetingType(data.meetingType)
    ? data.meetingType
    : null;

  return mapBaseAssignment(
    id,
    'congregation',
    congregationId,
    data,
    meetingTypeHint
  );
};
