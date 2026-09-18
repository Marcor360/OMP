/**
 * Operation identifiers are deterministic so a callable retry resumes the
 * same audit record instead of creating duplicate deletion operations.
 */
export const meetingDeletionOperationId = (meetingId: string): string =>
  `delete-meeting-${meetingId}`;

export const meetingAssignmentDeletionOperationId = (
  meetingId: string,
  assignmentId: string
): string => `delete-assignment-${meetingId}-${assignmentId}`;
