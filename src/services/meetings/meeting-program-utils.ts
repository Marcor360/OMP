import { Timestamp } from 'firebase/firestore';

import {
  Meeting,
  MeetingType,
} from '@/src/types/meeting';
import {
  MeetingAssignmentAssignee,
  MeetingProgramSection,
  MeetingProgramType,
  MeetingPublicationStatus,
  MeetingSpecialRoleKey,
  SPECIAL_CIRCUIT_OVERSEER_KEY,
  buildMeetingSearchableText,
  collectAssignedUserIds,
  createDefaultSectionsForMeetingType,
  normalizeMeetingSections,
} from '@/src/types/meeting/program';
import {
  MidweekAssignment,
  MidweekMeetingSection,
  ParticipantAssignment,
} from '@/src/types/midweek-meeting';
import { ActiveCongregationUser } from '@/src/services/users/active-users-service';
import {
  extractWeekendSessionsFromSections,
  validateWeekendSessionsForPublish,
} from '@/src/services/meetings/weekend-meeting-adapter';

export interface MeetingPublishValidationResult {
  isValid: boolean;
  assignedUserIds: string[];
  errors: string[];
}

export interface MeetingNormalizedPayload {
  meetingDate: Timestamp;
  publicationStatus: MeetingPublicationStatus;
  sections: MeetingProgramSection[];
  assignedUserIds: string[];
  searchableText: string;
}

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeSpecialRoleFromName = (
  value: string | undefined
): MeetingSpecialRoleKey | undefined => {
  if (!value) return undefined;

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalized.includes('superintendente de circuito')) {
    return SPECIAL_CIRCUIT_OVERSEER_KEY;
  }

  return undefined;
};

const toProgramAssigneeFromLegacyParticipant = (
  participant: ParticipantAssignment
): MeetingAssignmentAssignee => {
  if (
    participant.mode === 'specialRole' &&
    participant.specialRoleKey === SPECIAL_CIRCUIT_OVERSEER_KEY
  ) {
    return {
      id: participant.id,
      assigneeType: 'specialExternalRole',
      assigneeUserId: undefined,
      assigneeNameSnapshot:
        participant.displayName || 'Superintendente de circuito',
      specialRoleKey: SPECIAL_CIRCUIT_OVERSEER_KEY,
      externalCongregationName: undefined,
      publishNotificationSentAt: undefined,
      reminderSentAt: undefined,
    };
  }

  if (participant.mode === 'user' && participant.userId) {
    return {
      id: participant.id,
      assigneeType: 'registeredUser',
      assigneeUserId: participant.userId,
      assigneeNameSnapshot: participant.displayName,
      specialRoleKey: undefined,
      externalCongregationName: undefined,
      publishNotificationSentAt: undefined,
      reminderSentAt: undefined,
    };
  }

  const specialRole = normalizeSpecialRoleFromName(participant.displayName);

  if (specialRole) {
    return {
      id: participant.id,
      assigneeType: 'specialExternalRole',
      assigneeUserId: undefined,
      assigneeNameSnapshot: participant.displayName,
      specialRoleKey: specialRole,
      externalCongregationName: undefined,
      publishNotificationSentAt: undefined,
      reminderSentAt: undefined,
    };
  }

  return {
    id: participant.id,
    assigneeType: 'informational',
    assigneeUserId: undefined,
    assigneeNameSnapshot: participant.displayName,
    specialRoleKey: undefined,
    externalCongregationName: undefined,
    publishNotificationSentAt: undefined,
    reminderSentAt: undefined,
  };
};

export const inferMeetingProgramType = (meeting: Pick<Meeting, 'type' | 'meetingCategory'>): MeetingProgramType => {
  if (meeting.type === 'midweek' || meeting.meetingCategory === 'midweek') {
    return 'midweek';
  }

  return 'weekend';
};

const toProgramAssignmentScopeFromLegacy = (assignment: MidweekAssignment) => {
  if (assignment.participants.some((participant) => participant.mode === 'manual')) {
    return 'informational' as const;
  }

  if (
    assignment.assignmentType === 'song' ||
    assignment.assignmentType === 'other'
  ) {
    return 'informational' as const;
  }

  return 'internal' as const;
};

export const convertLegacyMidweekSectionsToProgramSections = (
  legacySections: MidweekMeetingSection[]
): MeetingProgramSection[] => {
  if (!Array.isArray(legacySections) || legacySections.length === 0) {
    return createDefaultSectionsForMeetingType('midweek');
  }

  const mapped = legacySections.map((section, sectionIndex) => ({
    sectionKey: section.id,
    title: section.title,
    order: section.order ?? sectionIndex,
    sectionType: 'predefined' as const,
    isRequired: true,
    isEnabled: true,
    assignments: section.items.map((assignment) => ({
      assignmentKey: assignment.id,
      sectionKey: section.id,
      title: assignment.title,
      roleLabel: undefined,
      assignmentScope: toProgramAssignmentScopeFromLegacy(assignment),
      assignees:
        assignment.participants.length > 0
          ? assignment.participants.map(toProgramAssigneeFromLegacyParticipant)
          : [
              {
                id: `${assignment.id}-fallback-assignee`,
                assigneeType: 'registeredUser',
                assigneeNameSnapshot: '',
              },
            ],
      roomKey: assignment.roomKey,
      startTime: assignment.startTime,
      endTime: assignment.endTime,
      durationMinutes: assignment.durationMinutes,
      allowCircuitOverseerOption: true,
      notes: assignment.notes,
    })),
  }));

  return normalizeMeetingSections(mapped, 'midweek');
};

const toLegacyParticipantFromProgramAssignee = (
  assignee: MeetingAssignmentAssignee,
  fallbackIndex: number
): ParticipantAssignment => {
  if (assignee.assigneeType === 'registeredUser') {
    return {
      id: assignee.id || `legacy-participant-${fallbackIndex + 1}`,
      mode: 'user',
      userId: assignee.assigneeUserId,
      displayName: assignee.assigneeNameSnapshot ?? '',
      specialRoleKey: undefined,
      roleLabel: undefined,
      gender: undefined,
      isAssistant: false,
    };
  }

  if (assignee.assigneeType === 'specialExternalRole') {
    return {
      id: assignee.id || `legacy-participant-${fallbackIndex + 1}`,
      mode: 'specialRole',
      userId: undefined,
      displayName: assignee.assigneeNameSnapshot || 'Superintendente de circuito',
      specialRoleKey: SPECIAL_CIRCUIT_OVERSEER_KEY,
      roleLabel: undefined,
      gender: undefined,
      isAssistant: false,
    };
  }

  return {
    id: assignee.id || `legacy-participant-${fallbackIndex + 1}`,
    mode: 'manual',
    userId: undefined,
    displayName: assignee.assigneeNameSnapshot ?? '',
    specialRoleKey: undefined,
    roleLabel: undefined,
    gender: undefined,
    isAssistant: false,
  };
};

export const convertProgramSectionsToLegacyMidweekSections = (
  sections: MeetingProgramSection[]
): MidweekMeetingSection[] => {
  const coreSectionKeys = [
    'treasuresOfTheBible',
    'applyYourselfToTheFieldMinistry',
    'livingAsChristians',
  ];

  const filtered = sections
    .filter((section) => coreSectionKeys.includes(section.sectionKey))
    .sort((left, right) => left.order - right.order);

  return filtered.map((section, sectionIndex) => ({
    id: section.sectionKey as MidweekMeetingSection['id'],
    title: section.title,
    order: sectionIndex,
    items: section.assignments.map((assignment, assignmentIndex) => ({
      id: assignment.assignmentKey,
      sectionId: section.sectionKey as MidweekMeetingSection['id'],
      order: assignmentIndex,
      title: assignment.title,
      theme: undefined,
      durationMinutes: assignment.durationMinutes,
      notes: assignment.notes,
      roomKey: assignment.roomKey,
      startTime: assignment.startTime,
      endTime: assignment.endTime,
      participants: assignment.assignees.map((assignee, assigneeIndex) =>
        toLegacyParticipantFromProgramAssignee(assignee, assigneeIndex)
      ),
      isOptional: undefined,
      assignmentType: 'other',
    })),
  }));
};

const getTimestampFromDateLike = (value: unknown): Timestamp | undefined => {
  if (value instanceof Timestamp) {
    return value;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return Timestamp.fromDate(value);
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    return Timestamp.fromDate((value as { toDate: () => Date }).toDate());
  }

  return undefined;
};

const normalizeAssigneeForStorage = (
  assignee: MeetingAssignmentAssignee
): MeetingAssignmentAssignee => {
  const normalizedNameSnapshot = normalizeText(assignee.assigneeNameSnapshot);
  const fallbackInformationalName = normalizedNameSnapshot ?? 'Sin asignar';

  if (assignee.assigneeType === 'registeredUser') {
    const normalizedUserId = normalizeText(assignee.assigneeUserId);

    // Si no hay UID valido, lo tratamos como informativo (sin notificaciones).
    // Esto evita guardar "registeredUser" incompletos que pueden ser rechazados al persistir.
    if (!normalizedUserId) {
      return {
        ...assignee,
        assigneeType: 'informational',
        assigneeUserId: undefined,
        assigneeNameSnapshot: fallbackInformationalName,
        specialRoleKey: undefined,
      };
    }

    return {
      ...assignee,
      assigneeType: 'registeredUser',
      assigneeUserId: normalizedUserId,
      assigneeNameSnapshot: normalizedNameSnapshot,
      specialRoleKey: undefined,
    };
  }

  if (assignee.assigneeType === 'specialExternalRole') {
    return {
      ...assignee,
      assigneeType: 'specialExternalRole',
      assigneeUserId: undefined,
      assigneeNameSnapshot: normalizedNameSnapshot,
    };
  }

  return {
    ...assignee,
    assigneeType: 'informational',
    assigneeUserId: undefined,
    assigneeNameSnapshot: normalizedNameSnapshot ?? 'Sin asignar',
    specialRoleKey: undefined,
  };
};

const normalizeSectionsForStorage = (
  sections: MeetingProgramSection[]
): MeetingProgramSection[] =>
  sections.map((section) => ({
    ...section,
    assignments: section.assignments.map((assignment) => {
      const normalizedAssignees = assignment.assignees.map(normalizeAssigneeForStorage);
      const hasInformationalAssignee = normalizedAssignees.some(
        (assignee) => assignee.assigneeType === 'informational'
      );
      const currentScope =
        assignment.assignmentScope === 'informational' ? 'informational' : 'internal';

      return {
        ...assignment,
        assignmentScope:
          currentScope === 'internal' && hasInformationalAssignee ?
            'informational' :
            currentScope,
        assignees: normalizedAssignees,
      };
    }),
  }));

export const normalizeMeetingProgramPayload = (params: {
  meetingType: MeetingProgramType;
  title: string;
  description?: string;
  startDate: Timestamp;
  meetingDate?: Timestamp;
  sections?: unknown;
  publicationStatus?: MeetingPublicationStatus;
  legacyMidweekSections?: MidweekMeetingSection[];
}): MeetingNormalizedPayload => {
  const normalizedMeetingDate = params.meetingDate ?? params.startDate;

  const sectionsFromInput = normalizeMeetingSections(params.sections, params.meetingType);

  const sections =
    params.meetingType === 'midweek' &&
    (!Array.isArray(params.sections) || sectionsFromInput.length === 0) &&
    Array.isArray(params.legacyMidweekSections)
      ? convertLegacyMidweekSectionsToProgramSections(params.legacyMidweekSections)
      : sectionsFromInput;

  const sanitizedSections = normalizeSectionsForStorage(sections);
  const assignedUserIds = collectAssignedUserIds(sanitizedSections);

  return {
    meetingDate: normalizedMeetingDate,
    publicationStatus: params.publicationStatus ?? 'draft',
    sections: sanitizedSections,
    assignedUserIds,
    searchableText: buildMeetingSearchableText({
      title: params.title,
      description: params.description,
      sections: sanitizedSections,
    }),
  };
};

export const validateMeetingBeforePublish = (params: {
  meetingType: MeetingType;
  congregationId?: string | null;
  meetingDate?: Timestamp;
  sections: MeetingProgramSection[];
  activeUsers: ActiveCongregationUser[];
}): MeetingPublishValidationResult => {
  const errors: string[] = [];
  const sections = normalizeSectionsForStorage(params.sections);
  const usersById = new Map<string, ActiveCongregationUser>(
    params.activeUsers.map((user) => [user.uid, user])
  );

  if (!params.meetingType) {
    errors.push('La reunion debe tener tipo.');
  }

  if (!params.congregationId) {
    errors.push('La reunion debe pertenecer a una congregacion valida.');
  }

  if (!getTimestampFromDateLike(params.meetingDate)) {
    errors.push('La reunion debe tener una fecha valida.');
  }

  if (!Array.isArray(sections) || sections.length === 0) {
    errors.push('La reunion debe incluir al menos una seccion.');
  }

  sections
    .filter((section) => section.isEnabled !== false)
    .forEach((section) => {
      section.assignments.forEach((assignment) => {
        if (!normalizeText(assignment.title)) {
          errors.push(`La asignacion en la seccion "${section.title}" tiene titulo vacio.`);
        }

        if (assignment.assignmentScope !== 'internal') {
          return;
        }

        assignment.assignees.forEach((assignee) => {
          if (assignee.assigneeType === 'registeredUser') {
            const userId = normalizeText(assignee.assigneeUserId);
            if (!userId) {
              errors.push(`Falta usuario asignado en "${assignment.title}".`);
              return;
            }

            if (!usersById.has(userId)) {
              errors.push(`El usuario asignado en "${assignment.title}" no existe o esta inactivo.`);
            }

            return;
          }

          if (assignee.assigneeType === 'specialExternalRole') {
            if (assignee.specialRoleKey !== SPECIAL_CIRCUIT_OVERSEER_KEY) {
              errors.push(`La asignacion "${assignment.title}" tiene un rol especial invalido.`);
            }
            return;
          }

          errors.push(
            `La asignacion interna "${assignment.title}" no permite nombres manuales.`
          );
        });
      });
    });

  const isWeekendMeeting = params.meetingType !== 'midweek';
  if (isWeekendMeeting) {
    const weekendErrors = validateWeekendSessionsForPublish(
      extractWeekendSessionsFromSections(sections),
      params.activeUsers
    );
    weekendErrors.forEach((error) => {
      if (!errors.includes(error)) {
        errors.push(error);
      }
    });
  }

  const uniqueErrors = Array.from(new Set(errors));

  return {
    isValid: uniqueErrors.length === 0,
    assignedUserIds: collectAssignedUserIds(sections),
    errors: uniqueErrors,
  };
};

export const buildMeetingProgramFromMeeting = (meeting: Meeting): MeetingProgramSection[] => {
  const meetingType = inferMeetingProgramType(meeting);

  if (Array.isArray(meeting.sections) && meeting.sections.length > 0) {
    return normalizeMeetingSections(meeting.sections, meetingType);
  }

  if (meetingType === 'midweek' && Array.isArray(meeting.midweekSections) && meeting.midweekSections.length > 0) {
    return convertLegacyMidweekSectionsToProgramSections(meeting.midweekSections);
  }

  return createDefaultSectionsForMeetingType(meetingType);
};

export const getSectionByKey = (
  sections: MeetingProgramSection[],
  sectionKey: string
): MeetingProgramSection | undefined => sections.find((section) => section.sectionKey === sectionKey);

export const getZoomFieldsFromSections = (sections: MeetingProgramSection[]): {
  zoomMeetingId?: string;
  zoomLink?: string;
  zoomPasscode?: string;
} => {
  const zoomSection = getSectionByKey(sections, 'zoom');

  if (!zoomSection) {
    return {};
  }

  const resolveFieldValue = (assignmentTitle: string): string | undefined => {
    const assignment = zoomSection.assignments.find((item) => item.title === assignmentTitle);
    if (!assignment) return undefined;

    const firstAssignee = assignment.assignees[0];
    return normalizeText(firstAssignee?.assigneeNameSnapshot);
  };

  return {
    zoomMeetingId: resolveFieldValue('ID de reunion'),
    zoomLink: resolveFieldValue('Enlace'),
    zoomPasscode: resolveFieldValue('Codigo de acceso'),
  };
};

export interface MeetingAssignmentNotificationTarget {
  userId: string;
  assignmentKey: string;
  assignmentTitle: string;
  sectionKey: string;
  sectionTitle: string;
}

export const getInternalAssignmentNotificationTargets = (
  sections: MeetingProgramSection[]
): MeetingAssignmentNotificationTarget[] => {
  const targets: MeetingAssignmentNotificationTarget[] = [];

  sections.forEach((section) => {
    section.assignments.forEach((assignment) => {
      if (assignment.assignmentScope !== 'internal') {
        return;
      }

      assignment.assignees.forEach((assignee) => {
        const userId = normalizeText(assignee.assigneeUserId);
        if (assignee.assigneeType !== 'registeredUser' || !userId) {
          return;
        }

        targets.push({
          userId,
          assignmentKey: assignment.assignmentKey,
          assignmentTitle: assignment.title,
          sectionKey: section.sectionKey,
          sectionTitle: section.title,
        });
      });
    });
  });

  return targets;
};
