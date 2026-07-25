import { MeetingProgramAssignment } from '@/src/types/meeting/program';

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
