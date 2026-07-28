import { Timestamp } from 'firebase/firestore';

import { isHospitalityMicrophonesControlledReader } from '@/src/modules/assignments/utils/meeting-readers';
import { getActiveLocale } from '@/src/i18n/active-locale';
import { ActiveCongregationUser } from '@/src/services/users/active-users-service';
import {
  CreateMeetingDTO,
  Meeting,
  MeetingCleaningAssignmentMode,
  MeetingStatus,
} from '@/src/types/meeting';
import {
  MeetingProgramAssignment,
  MeetingProgramSection,
  MeetingProgramType,
} from '@/src/types/meeting/program';
import {
  MidweekAssignment,
  MidweekMeetingSection,
  ParticipantAssignment,
} from '@/src/types/midweek-meeting';

export type Mode = 'create' | 'edit';
export type SaveIntent = 'draft' | 'published';
export type FormStepKey = 'date' | 'basic' | 'program' | 'cleaning' | 'review';
export type WeekendMeetingDay = 'saturday' | 'sunday';
export type MidweekMeetingDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
export type CleaningSelectionMode = MeetingCleaningAssignmentMode;

export interface MeetingConflictNotice {
  id: string;
  title: string;
  dateLabel: string;
}

interface MarkerState {
  publishNotificationSentAt?: Timestamp;
  reminderSentAt?: Timestamp;
}

export const STATUS_OPTIONS: MeetingStatus[] = ['pending', 'scheduled', 'in_progress', 'completed', 'cancelled'];
export const TYPE_OPTIONS: MeetingProgramType[] = ['midweek', 'weekend'];

export const FORM_STEPS: { key: FormStepKey; title: string; subtitle: string }[] = [
  { key: 'date', title: 'Semana', subtitle: 'Tipo y dia' },
  { key: 'basic', title: 'Datos', subtitle: 'Lugar y enlace' },
  { key: 'program', title: 'Programa', subtitle: 'Asignaciones' },
  { key: 'cleaning', title: 'Limpieza', subtitle: 'Modulos' },
  { key: 'review', title: 'Revision', subtitle: 'Publicacion' },
];

export const DEFAULT_TITLE_BY_TYPE: Record<MeetingProgramType, string> = {
  midweek: 'Reunion Vida y Ministerio Cristianos',
  weekend: 'Reunion del fin de semana',
};

export const WEEKEND_MEETING_DAY_LABELS: Record<WeekendMeetingDay, string> = {
  saturday: 'Sabado',
  sunday: 'Domingo',
};

export const MIDWEEK_MEETING_DAY_LABELS: Record<MidweekMeetingDay, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miercoles',
  thursday: 'Jueves',
  friday: 'Viernes',
};

export const MIDWEEK_MEETING_DAY_OPTIONS: { value: MidweekMeetingDay; offset: number }[] = [
  { value: 'monday', offset: 0 },
  { value: 'tuesday', offset: 1 },
  { value: 'wednesday', offset: 2 },
  { value: 'thursday', offset: 3 },
  { value: 'friday', offset: 4 },
];

const pad = (value: number): string => String(value).padStart(2, '0');

export const formatDateInput = (value: Date): string => {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};

export const normalizeText = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const normalizeUrl = (value: string): string | undefined => {
  const trimmed = normalizeText(value);
  if (!trimmed) return undefined;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
    return undefined;
  } catch {
    return undefined;
  }
};

export const getTodayStart = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

export const toDateFromDateLike = (value?: Timestamp | Date): Date => {
  if (!value) {
    return new Date();
  }

  return value instanceof Date ? value : value.toDate();
};

const isSameCalendarDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

export const inferWeekendMeetingDay = (
  meetingDate: Date,
  range: { startDate: Date; endDate: Date }
): WeekendMeetingDay => {
  if (isSameCalendarDay(meetingDate, range.endDate) || meetingDate.getDay() === 0) {
    return 'sunday';
  }

  return 'saturday';
};

export const inferMidweekMeetingDay = (
  meetingDate: Date,
  range: { startDate: Date }
): MidweekMeetingDay => {
  const meetingDateStart = new Date(meetingDate);
  meetingDateStart.setHours(0, 0, 0, 0);

  const rangeStart = new Date(range.startDate);
  rangeStart.setHours(0, 0, 0, 0);

  const millisPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((meetingDateStart.getTime() - rangeStart.getTime()) / millisPerDay);
  const normalizedOffset = Math.min(4, Math.max(0, diffDays));

  const option = MIDWEEK_MEETING_DAY_OPTIONS.find((item) => item.offset === normalizedOffset);
  return option?.value ?? 'monday';
};

const sectionMarkerMap = (section: MeetingProgramSection): Map<string, MarkerState> => {
  const map = new Map<string, MarkerState>();
  section.assignments.forEach((assignment) => {
    assignment.assignees.forEach((assignee) => {
      map.set(`${assignment.assignmentKey}::${assignee.id}`, {
        publishNotificationSentAt: assignee.publishNotificationSentAt,
        reminderSentAt: assignee.reminderSentAt,
      });
    });
  });
  return map;
};

const programAssignmentToEditorAssignment = (assignment: MeetingProgramAssignment): MidweekAssignment => ({
  id: assignment.assignmentKey,
  sectionId: assignment.sectionKey as MidweekAssignment['sectionId'],
  order: 0,
  title: assignment.title,
  theme: assignment.roleLabel,
  durationMinutes: assignment.durationMinutes,
  notes: undefined,
  roomKey: undefined,
  startTime: undefined,
  endTime: undefined,
  assignmentScope: assignment.assignmentScope,
  controlledBy:
    assignment.controlledBy ??
    (isHospitalityMicrophonesControlledReader(assignment) ? 'hospitalityMicrophones' : undefined),
  lockedFromMeetingEditor:
    assignment.lockedFromMeetingEditor === true ||
    isHospitalityMicrophonesControlledReader(assignment),
  sourceModule:
    assignment.sourceModule ??
    (isHospitalityMicrophonesControlledReader(assignment) ? 'hospitalityMicrophones' : undefined),
  participants: assignment.assignees.map((assignee) => {
    if (assignee.assigneeType === 'registeredUser') {
      return {
        id: assignee.id,
        mode: 'user',
        userId: assignee.assigneeUserId,
        displayName: assignee.assigneeNameSnapshot ?? '',
        specialRoleKey: undefined,
        roleLabel: undefined,
        gender: undefined,
        isAssistant: false,
      } as ParticipantAssignment;
    }

    return {
      id: assignee.id,
      mode: 'manual',
      userId: undefined,
      displayName: assignee.assigneeNameSnapshot ?? '',
      specialRoleKey: undefined,
      roleLabel: undefined,
      gender: undefined,
      isAssistant: false,
    } as ParticipantAssignment;
  }),
  isOptional: false,
  assignmentType: undefined,
  allowCircuitOverseerOption: false,
});

export const programSectionToEditorSection = (section: MeetingProgramSection): MidweekMeetingSection => ({
  id: section.sectionKey as MidweekMeetingSection['id'],
  title: section.title,
  order: section.order,
  sectionType: section.sectionType,
  isRequired: section.isRequired,
  isEnabled: section.isEnabled,
  colorToken: section.colorToken,
  items: section.assignments.map((assignment, index) => ({
    ...programAssignmentToEditorAssignment(assignment),
    order: index,
  })),
});

const editorParticipantToProgramAssignee = (
  participant: ParticipantAssignment,
  assignmentKey: string,
  markers: Map<string, MarkerState>
): MeetingProgramAssignment['assignees'][number] => {
  const marker = markers.get(`${assignmentKey}::${participant.id}`);

  if (participant.mode === 'user') {
    return {
      id: participant.id,
      assigneeType: 'registeredUser',
      assigneeUserId: normalizeText(participant.userId ?? ''),
      assigneeNameSnapshot: normalizeText(participant.displayName),
      specialRoleKey: undefined,
      publishNotificationSentAt: marker?.publishNotificationSentAt,
      reminderSentAt: marker?.reminderSentAt,
    };
  }

  return {
    id: participant.id,
    assigneeType: 'informational',
    assigneeUserId: undefined,
    assigneeNameSnapshot: normalizeText(participant.displayName),
    specialRoleKey: undefined,
    publishNotificationSentAt: marker?.publishNotificationSentAt,
    reminderSentAt: marker?.reminderSentAt,
  };
};

export const editorSectionToProgramSection = (
  editorSection: MidweekMeetingSection,
  currentSection: MeetingProgramSection
): MeetingProgramSection => {
  const markers = sectionMarkerMap(currentSection);

  return {
    sectionKey: currentSection.sectionKey,
    title: editorSection.title,
    order: currentSection.order,
    sectionType: currentSection.sectionType,
    isRequired: currentSection.isRequired,
    isEnabled: editorSection.isEnabled !== false,
    colorToken: currentSection.colorToken,
    assignments: editorSection.items.map((assignment) => {
      const currentAssignment = currentSection.assignments.find(
        (item) => item.assignmentKey === assignment.id
      );
      const participants =
        editorSection.id === 'livingAsChristians'
          ? assignment.participants.slice(0, 2)
          : assignment.participants;

      return {
        assignmentKey: assignment.id,
        sectionKey: currentSection.sectionKey,
        title: assignment.title,
        roleLabel: normalizeText(assignment.theme ?? ''),
        assignmentScope: assignment.assignmentScope ?? 'internal',
        controlledBy: currentAssignment?.controlledBy ?? assignment.controlledBy,
        lockedFromMeetingEditor:
          currentAssignment?.lockedFromMeetingEditor ?? assignment.lockedFromMeetingEditor,
        sourceModule: currentAssignment?.sourceModule ?? assignment.sourceModule,
        assignees: participants.map((participant) =>
          editorParticipantToProgramAssignee(participant, assignment.id, markers)
        ),
        roomKey: undefined,
        startTime: undefined,
        endTime: undefined,
        durationMinutes: assignment.durationMinutes,
        allowCircuitOverseerOption: false,
        notes: undefined,
      };
    }),
  };
};

export const inferProgramTypeFromMeeting = (meeting: Meeting): MeetingProgramType =>
  meeting.type === 'midweek' || meeting.meetingCategory === 'midweek' ? 'midweek' : 'weekend';

export const getDateFromMeetingValue = (value?: Timestamp | Date): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : value.toDate();
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatHumanDate = (value: Date): string =>
  value.toLocaleDateString(getActiveLocale(), {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

export const meetingMatchesProgramType = (meeting: Meeting, meetingType: MeetingProgramType): boolean =>
  inferProgramTypeFromMeeting(meeting) === meetingType;

export const buildMeetingPayload = (params: {
  startDate: Date;
  endDate: Date;
  actorUid: string;
  resolvedMeetingDate: Date;
  title: string;
  description: string;
  meetingType: MeetingProgramType;
  selectedWeekLabel: string;
  status: MeetingStatus;
  location: string;
  meetingUrl: string;
  notes: string;
  effectiveSections: MeetingProgramSection[];
  cleaningSelectionMode: MeetingCleaningAssignmentMode;
  selectedCleaningGroups: { id: string; name: string }[];
}): CreateMeetingDTO => {
  const startTimestamp = Timestamp.fromDate(params.startDate);
  const endTimestamp = Timestamp.fromDate(params.endDate);
  const meetingDateTimestamp = Timestamp.fromDate(params.resolvedMeetingDate);

  return {
    title: normalizeText(params.title) ?? DEFAULT_TITLE_BY_TYPE[params.meetingType],
    description: normalizeText(params.description),
    type: params.meetingType,
    meetingCategory: params.meetingType,
    weekLabel: params.meetingType === 'midweek' ? params.selectedWeekLabel : undefined,
    status: params.status,
    publicationStatus: 'draft',
    startDate: startTimestamp,
    endDate: endTimestamp,
    meetingDate: meetingDateTimestamp,
    location: normalizeText(params.location),
    meetingUrl: normalizeUrl(params.meetingUrl),
    notes: normalizeText(params.notes),
    sections: params.effectiveSections,
    cleaningAssignmentMode: params.cleaningSelectionMode,
    cleaningGroupIds: params.selectedCleaningGroups.map((group) => group.id),
    cleaningGroupNames: params.selectedCleaningGroups.map((group) => group.name),
    attendees: [params.actorUid],
    createdBy: params.actorUid,
    updatedBy: params.actorUid,
  };
};

export const collectBlockedAssignedUserNames = (
  sections: MeetingProgramSection[],
  blockedUserIds: Set<string>,
  users: ActiveCongregationUser[]
): string[] => {
  const usersById = new Map(users.map((item) => [item.uid, item.displayName]));
  const names = new Set<string>();

  sections.forEach((section) => {
    section.assignments.forEach((assignment) => {
      assignment.assignees.forEach((assignee) => {
        const userId = normalizeText(assignee.assigneeUserId ?? '');
        if (userId && blockedUserIds.has(userId)) {
          names.add(usersById.get(userId) ?? assignee.assigneeNameSnapshot ?? userId);
        }
      });
    });
  });

  return Array.from(names);
};
