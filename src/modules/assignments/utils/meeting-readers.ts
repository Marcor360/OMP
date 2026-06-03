import { Timestamp } from 'firebase/firestore';

import { ActiveCongregationUser } from '@/src/services/users/active-users-service';
import {
  buildMeetingProgramFromMeeting,
} from '@/src/services/meetings/meeting-program-utils';
import { updateMeeting } from '@/src/services/meetings/meetings-service';
import { Meeting, UpdateMeetingDTO } from '@/src/types/meeting';
import {
  MeetingProgramAssignment,
  MeetingProgramSection,
  collectAssignedUserIds,
} from '@/src/types/meeting/program';

export type ControlledReaderKind = 'midweekBibleStudyReader' | 'weekendWatchtowerReader';

export type ControlledReaderSlot = {
  assignmentKey: string;
  sectionKey: string;
  meetingId: string;
  meetingType: 'midweek' | 'weekend';
  kind: ControlledReaderKind;
  title: string;
  sectionTitle: string;
  assignedUserId?: string;
  assignedUserName?: string;
};

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const isHospitalityMicrophonesControlledReader = (
  assignment: Pick<MeetingProgramAssignment, 'sectionKey' | 'title' | 'roleLabel'>
): boolean => {
  const roleLabel = normalizeText(assignment.roleLabel)?.toLowerCase();
  const title = normalizeText(assignment.title)?.toLowerCase() ?? '';

  if (assignment.sectionKey === 'livingAsChristians') {
    return roleLabel === 'lector' && title === 'lector';
  }

  if (assignment.sectionKey.startsWith('weekendAssignments')) {
    return roleLabel === 'lector' && title.includes('lector del estudio');
  }

  return false;
};

export const markAssignmentAsHospitalityMicrophonesControlled = (
  assignment: MeetingProgramAssignment
): MeetingProgramAssignment => ({
  ...assignment,
  controlledBy: 'hospitalityMicrophones',
  lockedFromMeetingEditor: true,
  sourceModule: 'hospitalityMicrophones',
});

export const lockHospitalityMicrophonesReaderAssignments = (
  sections: MeetingProgramSection[]
): MeetingProgramSection[] =>
  sections.map((section) => ({
    ...section,
    assignments: section.assignments.map((assignment) =>
      isHospitalityMicrophonesControlledReader(assignment)
        ? markAssignmentAsHospitalityMicrophonesControlled(assignment)
        : assignment
    ),
  }));

export const listControlledReaderSlots = (meeting: Meeting): ControlledReaderSlot[] => {
  const sections = lockHospitalityMicrophonesReaderAssignments(
    buildMeetingProgramFromMeeting(meeting)
  );
  const meetingType =
    meeting.type === 'midweek' || meeting.meetingCategory === 'midweek' ? 'midweek' : 'weekend';
  const slots: ControlledReaderSlot[] = [];

  sections.forEach((section) => {
    section.assignments.forEach((assignment) => {
      if (!isHospitalityMicrophonesControlledReader(assignment)) {
        return;
      }

      const firstAssignee = assignment.assignees.find(
        (assignee) => assignee.assigneeType === 'registeredUser'
      );

      slots.push({
        assignmentKey: assignment.assignmentKey,
        sectionKey: section.sectionKey,
        meetingId: meeting.id,
        meetingType,
        kind:
          meetingType === 'midweek'
            ? 'midweekBibleStudyReader'
            : 'weekendWatchtowerReader',
        title: assignment.title,
        sectionTitle: section.title,
        assignedUserId: normalizeText(firstAssignee?.assigneeUserId),
        assignedUserName: normalizeText(firstAssignee?.assigneeNameSnapshot),
      });
    });
  });

  return slots;
};

const toTimestamp = (value: unknown): Timestamp | undefined => {
  if (value instanceof Timestamp) return value;
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

export const assignControlledReaderToMeeting = async (params: {
  congregationId: string;
  meeting: Meeting;
  assignmentKey: string;
  user: ActiveCongregationUser;
  actorUid: string;
}): Promise<void> => {
  const sections = lockHospitalityMicrophonesReaderAssignments(
    buildMeetingProgramFromMeeting(params.meeting)
  );
  let changed = false;

  const nextSections = sections.map((section) => ({
    ...section,
    assignments: section.assignments.map((assignment) => {
      if (assignment.assignmentKey !== params.assignmentKey) {
        return assignment;
      }

      if (!isHospitalityMicrophonesControlledReader(assignment)) {
        return assignment;
      }

      changed = true;
      const existingAssignee = assignment.assignees[0];
      return markAssignmentAsHospitalityMicrophonesControlled({
        ...assignment,
        assignees: [
          {
            id: existingAssignee?.id ?? `${assignment.assignmentKey}-reader`,
            assigneeType: 'registeredUser',
            assigneeUserId: params.user.uid,
            assigneeNameSnapshot: params.user.displayName,
            specialRoleKey: undefined,
            externalCongregationName: undefined,
            publishNotificationSentAt: existingAssignee?.publishNotificationSentAt,
            reminderSentAt: existingAssignee?.reminderSentAt,
          },
        ],
      });
    }),
  }));

  if (!changed) {
    throw new Error('No se encontro una asignacion de lector controlada en esta reunion.');
  }

  const payload: UpdateMeetingDTO = {
    title: params.meeting.title,
    description: params.meeting.description,
    type: params.meeting.type,
    meetingCategory: params.meeting.meetingCategory,
    status: params.meeting.status,
    publicationStatus: params.meeting.publicationStatus,
    weekLabel: params.meeting.weekLabel,
    startDate: toTimestamp(params.meeting.startDate),
    endDate: toTimestamp(params.meeting.endDate),
    meetingDate: toTimestamp(params.meeting.meetingDate ?? params.meeting.startDate),
    location: params.meeting.location,
    meetingUrl: params.meeting.meetingUrl,
    notes: params.meeting.notes,
    sections: nextSections,
    assignedUserIds: collectAssignedUserIds(nextSections),
    cleaningAssignmentMode: params.meeting.cleaningAssignmentMode,
    cleaningGroupIds: params.meeting.cleaningGroupIds,
    cleaningGroupNames: params.meeting.cleaningGroupNames,
    updatedBy: params.actorUid,
  };

  await updateMeeting(params.congregationId, params.meeting.id, payload);
};
