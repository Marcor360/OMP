import { getCleaningAssignmentsForMeetingDate } from '@/src/services/cleaning/cleaning-schedule-service';
import { getHospitalityAssignmentsForMeetingDate } from '@/src/services/hospitality-microphones/hospitality-microphones-service';
import {
  isHospitalityMicrophonesControlledReader,
  markAssignmentAsHospitalityMicrophonesControlled,
} from '@/src/modules/assignments/utils/meeting-readers';
import {
  HospitalityRoleKey,
  HospitalityScheduleItem,
} from '@/src/types/hospitality-microphones';
import {
  MeetingProgramAssignment,
  MeetingProgramSection,
} from '@/src/types/meeting/program';
import { formatDateKey } from '@/src/utils/dates/date-key';

const HOSPITALITY_SECTION_KEY = 'hospitalityMicrophones';

const HOSPITALITY_ROLE_LABELS: Record<HospitalityRoleKey, string> = {
  chairman: 'Presidente',
  microphoneOne: 'Microfono 1',
  microphoneTwo: 'Microfono 2',
  microphoneThree: 'Microfono 3',
  attendantDoor: 'Acomodador de puerta',
  attendantAuditorium: 'Acomodador de auditorio',
  attendantExtra: 'Acomodador extra',
  watchtowerReader: 'Lector del Estudio de la Atalaya',
  midweekBibleStudyReader: 'Lector del Estudio Biblico',
  audioVideo: 'Audio y video',
};

const isReaderRole = (roleKey: HospitalityRoleKey): boolean =>
  roleKey === 'watchtowerReader' || roleKey === 'midweekBibleStudyReader';

// Orden de aparicion en la seccion de la reunion: el presidente siempre va primero.
const HOSPITALITY_ROLE_ORDER: Record<HospitalityRoleKey, number> = {
  chairman: 0,
  microphoneOne: 1,
  microphoneTwo: 2,
  microphoneThree: 3,
  attendantDoor: 4,
  attendantAuditorium: 5,
  attendantExtra: 6,
  audioVideo: 7,
  watchtowerReader: 8,
  midweekBibleStudyReader: 8,
};

const createAssignee = (item: HospitalityScheduleItem) => ({
  id: `${item.roleKey}-${item.userId}`,
  assigneeType: 'registeredUser' as const,
  assigneeUserId: item.userId,
  assigneeNameSnapshot: item.userNameSnapshot,
  specialRoleKey: undefined,
  externalCongregationName: undefined,
  publishNotificationSentAt: undefined,
  reminderSentAt: undefined,
});

const createHospitalityAssignment = (
  item: HospitalityScheduleItem,
  order: number
): MeetingProgramAssignment =>
  markAssignmentAsHospitalityMicrophonesControlled({
    assignmentKey: `${HOSPITALITY_SECTION_KEY}-${item.roleKey}`,
    sectionKey: HOSPITALITY_SECTION_KEY,
    title: HOSPITALITY_ROLE_LABELS[item.roleKey] ?? item.roleLabel,
    roleLabel: item.roleLabel || HOSPITALITY_ROLE_LABELS[item.roleKey],
    assignmentScope: 'internal',
    assignees: [createAssignee(item)],
    roomKey: undefined,
    startTime: undefined,
    endTime: undefined,
    durationMinutes: undefined,
    allowCircuitOverseerOption: false,
    notes: undefined,
  });

const upsertHospitalitySection = (
  sections: MeetingProgramSection[],
  items: HospitalityScheduleItem[]
): MeetingProgramSection[] => {
  const nonReaderItems = items.filter((item) => !isReaderRole(item.roleKey));
  if (nonReaderItems.length === 0) return sections;

  const existingIndex = sections.findIndex((section) => section.sectionKey === HOSPITALITY_SECTION_KEY);
  const existingSection = existingIndex >= 0 ? sections[existingIndex] : null;
  const controlledKeys = new Set(
    nonReaderItems.map((item) => `${HOSPITALITY_SECTION_KEY}-${item.roleKey}`)
  );
  const existingAssignments = existingSection?.assignments.filter(
    (assignment) => !controlledKeys.has(assignment.assignmentKey)
  ) ?? [];
  const orderedNonReaderItems = [...nonReaderItems].sort(
    (left, right) => HOSPITALITY_ROLE_ORDER[left.roleKey] - HOSPITALITY_ROLE_ORDER[right.roleKey]
  );
  const controlledAssignments = orderedNonReaderItems.map((item, index) =>
    createHospitalityAssignment(item, existingAssignments.length + index)
  );
  const nextSection: MeetingProgramSection = {
    sectionKey: HOSPITALITY_SECTION_KEY,
    title: 'Acomodadores y Microfonos',
    order: existingSection?.order ?? sections.length,
    sectionType: 'dynamic',
    isRequired: false,
    isEnabled: true,
    colorToken: 'teal',
    assignments: [...existingAssignments, ...controlledAssignments],
  };

  if (existingIndex < 0) {
    return [...sections, nextSection].map((section, index) => ({
      ...section,
      order: index,
    }));
  }

  return sections.map((section, index) =>
    index === existingIndex ? nextSection : section
  );
};

const applyReaderItems = (
  sections: MeetingProgramSection[],
  items: HospitalityScheduleItem[],
  meetingType: 'midweek' | 'weekend'
): MeetingProgramSection[] => {
  const targetRole =
    meetingType === 'midweek' ? 'midweekBibleStudyReader' : 'watchtowerReader';
  const item = items.find((candidate) => candidate.roleKey === targetRole);
  if (!item) return sections;

  return sections.map((section) => ({
    ...section,
    assignments: section.assignments.map((assignment) => {
      if (!isHospitalityMicrophonesControlledReader(assignment)) {
        return assignment;
      }

      return markAssignmentAsHospitalityMicrophonesControlled({
        ...assignment,
        assignees: [createAssignee(item)],
      });
    }),
  }));
};

export const applyPublishedPlanningToMeeting = async (params: {
  congregationId: string;
  meetingId?: string;
  meetingType: 'midweek' | 'weekend';
  meetingDate: Date;
  sections: MeetingProgramSection[];
}): Promise<{
  sections: MeetingProgramSection[];
  cleaningGroupIds: string[];
  cleaningGroupNames: string[];
  warnings: string[];
}> => {
  const meetingDateKey = formatDateKey(params.meetingDate);
  const [hospitalityItems, cleaningItems] = await Promise.all([
    getHospitalityAssignmentsForMeetingDate({
      congregationId: params.congregationId,
      meetingDate: meetingDateKey,
      meetingType: params.meetingType,
    }),
    getCleaningAssignmentsForMeetingDate({
      congregationId: params.congregationId,
      meetingDate: meetingDateKey,
      meetingType: params.meetingType,
    }),
  ]);
  const warnings: string[] = [];
  let sections = applyReaderItems(params.sections, hospitalityItems, params.meetingType);
  sections = upsertHospitalitySection(sections, hospitalityItems);

  if (hospitalityItems.length === 0) {
    warnings.push('No hay lista publicada de acomodadores y microfonos para esta fecha.');
  }

  if (cleaningItems.length === 0) {
    warnings.push('No hay lista publicada de limpieza para esta fecha.');
  }

  return {
    sections,
    cleaningGroupIds: cleaningItems.map((item) => item.cleaningGroupId),
    cleaningGroupNames: cleaningItems.map((item) => item.cleaningGroupName),
    warnings,
  };
};
