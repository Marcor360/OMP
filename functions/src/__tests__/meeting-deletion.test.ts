import {
  meetingAssignmentDeletionOperationId,
  meetingDeletionOperationId,
} from '../modules/meetings/meeting-deletion.js';

describe('meeting deletion operation identifiers', () => {
  it('uses the same audit document for a retried meeting deletion', () => {
    expect(meetingDeletionOperationId('midweek_2026-09-17'))
      .toBe(meetingDeletionOperationId('midweek_2026-09-17'));
  });

  it('keeps assignment retries scoped to both meeting and assignment', () => {
    expect(meetingAssignmentDeletionOperationId('meeting-a', 'assignment-a'))
      .toBe('delete-assignment-meeting-a-assignment-a');
    expect(meetingAssignmentDeletionOperationId('meeting-a', 'assignment-a'))
      .not.toBe(meetingAssignmentDeletionOperationId('meeting-b', 'assignment-a'));
  });
});
