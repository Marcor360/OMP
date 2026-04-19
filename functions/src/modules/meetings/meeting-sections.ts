import { Timestamp } from 'firebase-admin/firestore';

export type NormalizedMeetingType = 'midweek' | 'weekend';
export type MeetingAssignmentScope = 'internal' | 'informational';

export type MeetingAssigneeType =
  | 'registeredUser'
  | 'specialExternalRole'
  | 'informational';

export type MeetingSpecialRoleKey = 'circuitOverseer';

export const SPECIAL_CIRCUIT_OVERSEER_KEY: MeetingSpecialRoleKey =
  'circuitOverseer';

export interface NormalizedMeetingAssignee {
  id: string;
  assigneeType: MeetingAssigneeType;
  assigneeUserId?: string;
  assigneeNameSnapshot?: string;
  specialRoleKey?: MeetingSpecialRoleKey;
  publishNotificationSentAt?: Timestamp;
  reminderSentAt?: Timestamp;
}

export interface NormalizedMeetingAssignment {
  assignmentKey: string;
  sectionKey: string;
  title: string;
  assignmentScope: MeetingAssignmentScope;
  assignees: NormalizedMeetingAssignee[];
}

export interface NormalizedMeetingSection {
  sectionKey: string;
  title: string;
  order: number;
  isEnabled: boolean;
  assignments: NormalizedMeetingAssignment[];
}

export interface MeetingAssignmentTarget {
  targetKey: string;
  userId: string;
  sectionKey: string;
  sectionTitle: string;
  assignmentKey: string;
  assignmentTitle: string;
  assigneeId: string;
}

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizedComparableText = (value: unknown): string => {
  const text = normalizeText(value) ?? '';

  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const inferSpecialRoleFromName = (
  name: string | undefined
): MeetingSpecialRoleKey | undefined => {
  if (!name) return undefined;

  if (normalizedComparableText(name).includes('superintendente de circuito')) {
    return SPECIAL_CIRCUIT_OVERSEER_KEY;
  }

  return undefined;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
};

const toTimestamp = (value: unknown): Timestamp | undefined => {
  if (value instanceof Timestamp) {
    return value;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return Timestamp.fromDate(value);
  }

  const raw = asRecord(value);
  if (!raw) {
    return undefined;
  }

  const toDate = raw.toDate;
  if (typeof toDate === 'function') {
    const date = (toDate as () => Date)();
    if (!Number.isNaN(date.getTime())) {
      return Timestamp.fromDate(date);
    }
  }

  const seconds = raw.seconds;
  const nanoseconds = raw.nanoseconds;

  if (typeof seconds === 'number' && typeof nanoseconds === 'number') {
    return new Timestamp(seconds, nanoseconds);
  }

  return undefined;
};

const normalizeAssignee = (
  value: unknown,
  fallbackPrefix: string,
  index: number
): NormalizedMeetingAssignee => {
  const raw = asRecord(value) ?? {};
  const fallbackId = `${fallbackPrefix}-assignee-${index + 1}`;

  if (
    raw.assigneeType === 'registeredUser' ||
    raw.assigneeType === 'specialExternalRole' ||
    raw.assigneeType === 'informational'
  ) {
    const assigneeType = raw.assigneeType;
    const userId = normalizeText(raw.assigneeUserId);
    const nameSnapshot = normalizeText(raw.assigneeNameSnapshot);
    const specialRoleKey =
      raw.specialRoleKey === SPECIAL_CIRCUIT_OVERSEER_KEY
        ? SPECIAL_CIRCUIT_OVERSEER_KEY
        : inferSpecialRoleFromName(nameSnapshot);

    return {
      id: normalizeText(raw.id) ?? fallbackId,
      assigneeType,
      assigneeUserId: assigneeType === 'registeredUser' ? userId : undefined,
      assigneeNameSnapshot: nameSnapshot,
      specialRoleKey:
        assigneeType === 'specialExternalRole' ? specialRoleKey : undefined,
      publishNotificationSentAt: toTimestamp(raw.publishNotificationSentAt),
      reminderSentAt: toTimestamp(raw.reminderSentAt),
    };
  }

  const mode = raw.mode;
  const displayName = normalizeText(raw.displayName);
  const specialRoleFromMode =
    mode === 'specialRole' && raw.specialRoleKey === SPECIAL_CIRCUIT_OVERSEER_KEY
      ? SPECIAL_CIRCUIT_OVERSEER_KEY
      : inferSpecialRoleFromName(displayName);

  if (mode === 'specialRole' || specialRoleFromMode) {
    return {
      id: normalizeText(raw.id) ?? fallbackId,
      assigneeType: 'specialExternalRole',
      assigneeNameSnapshot:
        displayName ?? 'Superintendente de circuito',
      specialRoleKey: SPECIAL_CIRCUIT_OVERSEER_KEY,
      publishNotificationSentAt: toTimestamp(raw.publishNotificationSentAt),
      reminderSentAt: toTimestamp(raw.reminderSentAt),
    };
  }

  if (mode === 'manual') {
    return {
      id: normalizeText(raw.id) ?? fallbackId,
      assigneeType: 'informational',
      assigneeNameSnapshot: displayName,
      publishNotificationSentAt: toTimestamp(raw.publishNotificationSentAt),
      reminderSentAt: toTimestamp(raw.reminderSentAt),
    };
  }

  return {
    id: normalizeText(raw.id) ?? fallbackId,
    assigneeType: 'registeredUser',
    assigneeUserId: normalizeText(raw.userId) ?? normalizeText(raw.assigneeUserId),
    assigneeNameSnapshot: displayName ?? normalizeText(raw.assigneeNameSnapshot),
    publishNotificationSentAt: toTimestamp(raw.publishNotificationSentAt),
    reminderSentAt: toTimestamp(raw.reminderSentAt),
  };
};

const normalizeAssignmentScope = (
  raw: Record<string, unknown>,
  assignees: NormalizedMeetingAssignee[]
): MeetingAssignmentScope => {
  if (raw.assignmentScope === 'internal' || raw.assignmentScope === 'informational') {
    return raw.assignmentScope;
  }

  const hasInformationalAssignee = assignees.some(
    (assignee) => assignee.assigneeType === 'informational'
  );

  if (hasInformationalAssignee) {
    return 'informational';
  }

  if (raw.assignmentType === 'song' || raw.assignmentType === 'other') {
    return 'informational';
  }

  return 'internal';
};

const normalizeAssignment = (
  sectionKey: string,
  value: unknown,
  index: number
): NormalizedMeetingAssignment => {
  const raw = asRecord(value) ?? {};
  const assignmentKey = normalizeText(raw.assignmentKey) ?? normalizeText(raw.id) ?? `${sectionKey}-assignment-${index + 1}`;

  const assigneesInput = Array.isArray(raw.assignees)
    ? raw.assignees
    : Array.isArray(raw.participants)
      ? raw.participants
      : [];

  const assignees = assigneesInput.map((assignee, assigneeIndex) =>
    normalizeAssignee(assignee, assignmentKey, assigneeIndex)
  );

  return {
    assignmentKey,
    sectionKey,
    title: normalizeText(raw.title) ?? `Asignacion ${index + 1}`,
    assignmentScope: normalizeAssignmentScope(raw, assignees),
    assignees,
  };
};

const normalizeSection = (
  value: unknown,
  index: number
): NormalizedMeetingSection | null => {
  const raw = asRecord(value);

  if (!raw) {
    return null;
  }

  const sectionKey =
    normalizeText(raw.sectionKey) ?? normalizeText(raw.id) ?? `section-${index + 1}`;

  const assignmentsInput = Array.isArray(raw.assignments)
    ? raw.assignments
    : Array.isArray(raw.items)
      ? raw.items
      : [];

  return {
    sectionKey,
    title: normalizeText(raw.title) ?? `Seccion ${index + 1}`,
    order:
      typeof raw.order === 'number' && Number.isFinite(raw.order)
        ? raw.order
        : index,
    isEnabled: raw.isEnabled !== false,
    assignments: assignmentsInput.map((assignment, assignmentIndex) =>
      normalizeAssignment(sectionKey, assignment, assignmentIndex)
    ),
  };
};

export const normalizeMeetingSectionsFromDoc = (
  data: Record<string, unknown>
): NormalizedMeetingSection[] => {
  const sectionsInput = Array.isArray(data.sections)
    ? data.sections
    : Array.isArray(data.midweekSections)
      ? data.midweekSections
      : [];

  const parsed = sectionsInput
    .map((section, sectionIndex) => normalizeSection(section, sectionIndex))
    .filter((section): section is NormalizedMeetingSection => section !== null)
    .sort((left, right) => left.order - right.order)
    .map((section, sectionIndex) => ({ ...section, order: sectionIndex }));

  return parsed;
};

export const buildAssignedUserIdsFromSections = (
  sections: NormalizedMeetingSection[]
): string[] => {
  const ids = new Set<string>();

  sections.forEach((section) => {
    if (!section.isEnabled) return;

    section.assignments.forEach((assignment) => {
      if (assignment.assignmentScope !== 'internal') return;

      assignment.assignees.forEach((assignee) => {
        if (assignee.assigneeType !== 'registeredUser') return;
        const userId = normalizeText(assignee.assigneeUserId);
        if (userId) {
          ids.add(userId);
        }
      });
    });
  });

  return Array.from(ids);
};

const buildTargetKey = (
  sectionKey: string,
  assignmentKey: string,
  assigneeId: string,
  userId: string
): string => `${sectionKey}::${assignmentKey}::${assigneeId}::${userId}`;

export const collectRegisteredInternalAssignmentTargets = (
  sections: NormalizedMeetingSection[]
): MeetingAssignmentTarget[] => {
  const targets: MeetingAssignmentTarget[] = [];

  sections.forEach((section) => {
    if (!section.isEnabled) return;

    section.assignments.forEach((assignment) => {
      if (assignment.assignmentScope !== 'internal') return;

      assignment.assignees.forEach((assignee) => {
        if (assignee.assigneeType !== 'registeredUser') return;

        const userId = normalizeText(assignee.assigneeUserId);
        if (!userId) return;

        const target: MeetingAssignmentTarget = {
          targetKey: buildTargetKey(
            section.sectionKey,
            assignment.assignmentKey,
            assignee.id,
            userId
          ),
          userId,
          sectionKey: section.sectionKey,
          sectionTitle: section.title,
          assignmentKey: assignment.assignmentKey,
          assignmentTitle: assignment.title,
          assigneeId: assignee.id,
        };

        targets.push(target);
      });
    });
  });

  return targets;
};

export const getUnnotifiedPublishTargets = (
  sections: NormalizedMeetingSection[]
): MeetingAssignmentTarget[] => {
  const targets = collectRegisteredInternalAssignmentTargets(sections);

  const sentTargetKeys = new Set<string>();

  sections.forEach((section) => {
    if (!section.isEnabled) return;

    section.assignments.forEach((assignment) => {
      if (assignment.assignmentScope !== 'internal') return;

      assignment.assignees.forEach((assignee) => {
        if (assignee.assigneeType !== 'registeredUser') return;
        const userId = normalizeText(assignee.assigneeUserId);
        if (!userId || !assignee.publishNotificationSentAt) return;

        sentTargetKeys.add(
          buildTargetKey(section.sectionKey, assignment.assignmentKey, assignee.id, userId)
        );
      });
    });
  });

  return targets.filter((target) => !sentTargetKeys.has(target.targetKey));
};

export const getPendingReminderTargets = (
  sections: NormalizedMeetingSection[]
): MeetingAssignmentTarget[] => {
  const targets = collectRegisteredInternalAssignmentTargets(sections);

  const sentTargetKeys = new Set<string>();

  sections.forEach((section) => {
    if (!section.isEnabled) return;

    section.assignments.forEach((assignment) => {
      if (assignment.assignmentScope !== 'internal') return;

      assignment.assignees.forEach((assignee) => {
        if (assignee.assigneeType !== 'registeredUser') return;
        const userId = normalizeText(assignee.assigneeUserId);
        if (!userId || !assignee.reminderSentAt) return;

        sentTargetKeys.add(
          buildTargetKey(section.sectionKey, assignment.assignmentKey, assignee.id, userId)
        );
      });
    });
  });

  return targets.filter((target) => !sentTargetKeys.has(target.targetKey));
};

const mapSectionsWithAssigneeUpdate = (
  sections: NormalizedMeetingSection[],
  targetKeys: Set<string>,
  mode: 'publish' | 'reminder',
  sentAt: Timestamp
): NormalizedMeetingSection[] => {
  return sections.map((section) => ({
    ...section,
    assignments: section.assignments.map((assignment) => ({
      ...assignment,
      assignees: assignment.assignees.map((assignee) => {
        if (assignee.assigneeType !== 'registeredUser') {
          return assignee;
        }

        const userId = normalizeText(assignee.assigneeUserId);
        if (!userId) {
          return assignee;
        }

        const key = buildTargetKey(
          section.sectionKey,
          assignment.assignmentKey,
          assignee.id,
          userId
        );

        if (!targetKeys.has(key)) {
          return assignee;
        }

        if (mode === 'publish') {
          return {
            ...assignee,
            publishNotificationSentAt: sentAt,
          };
        }

        return {
          ...assignee,
          reminderSentAt: sentAt,
        };
      }),
    })),
  }));
};

export const markPublishNotificationSentAt = (
  sections: NormalizedMeetingSection[],
  targetKeys: Set<string>,
  sentAt: Timestamp
): NormalizedMeetingSection[] =>
  mapSectionsWithAssigneeUpdate(sections, targetKeys, 'publish', sentAt);

export const markReminderSentAt = (
  sections: NormalizedMeetingSection[],
  targetKeys: Set<string>,
  sentAt: Timestamp
): NormalizedMeetingSection[] =>
  mapSectionsWithAssigneeUpdate(sections, targetKeys, 'reminder', sentAt);

export const clearMeetingNotificationMarkers = (
  sections: NormalizedMeetingSection[]
): NormalizedMeetingSection[] => {
  return sections.map((section) => ({
    ...section,
    assignments: section.assignments.map((assignment) => ({
      ...assignment,
      assignees: assignment.assignees.map((assignee) => ({
        id: assignee.id,
        assigneeType: assignee.assigneeType,
        assigneeUserId: assignee.assigneeUserId,
        assigneeNameSnapshot: assignee.assigneeNameSnapshot,
        specialRoleKey: assignee.specialRoleKey,
      })),
    })),
  }));
};

export const toFirestoreSectionsPayload = (
  sections: NormalizedMeetingSection[]
): Record<string, unknown>[] => {
  return sections.map((section) => ({
    sectionKey: section.sectionKey,
    title: section.title,
    order: section.order,
    isEnabled: section.isEnabled,
    assignments: section.assignments.map((assignment) => ({
      assignmentKey: assignment.assignmentKey,
      sectionKey: assignment.sectionKey,
      title: assignment.title,
      assignmentScope: assignment.assignmentScope,
      assignees: assignment.assignees.map((assignee) => ({
        id: assignee.id,
        assigneeType: assignee.assigneeType,
        assigneeUserId: assignee.assigneeUserId,
        assigneeNameSnapshot: assignee.assigneeNameSnapshot,
        specialRoleKey: assignee.specialRoleKey,
        publishNotificationSentAt: assignee.publishNotificationSentAt,
        reminderSentAt: assignee.reminderSentAt,
      })),
    })),
  }));
};

export const resolveMeetingType = (
  data: Record<string, unknown>
): NormalizedMeetingType => {
  const type = normalizeText(data.type);
  const category = normalizeText(data.meetingCategory);

  if (type === 'midweek' || category === 'midweek') {
    return 'midweek';
  }

  return 'weekend';
};

export const resolveMeetingDate = (
  data: Record<string, unknown>
): Timestamp | undefined => {
  return toTimestamp(data.meetingDate) ?? toTimestamp(data.startDate);
};

export const toDateLabel = (timestamp: Timestamp): string => {
  return timestamp.toDate().toLocaleDateString('es-MX', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};
