import { httpsCallable } from 'firebase/functions';
import { reconcileAssignmentIntents } from '../pending-assignment-service';
import { markAssignmentConfirmed, readPendingAssignments } from '../pending-assignment-store';

jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('@/src/lib/firebase/app', () => ({ auth: { currentUser: { uid: 'u1' } }, functions: {} }));
jest.mock('@/src/services/repositories/firestore/firestore-assignment-repository', () => ({ submitMeetingAssignment: jest.fn() }));
jest.mock('../pending-assignment-store', () => ({ readPendingAssignments: jest.fn(), markAssignmentConfirmed: jest.fn() }));

it('checks records beyond 20 and preserves confirmations after a failed lookup', async () => {
  const scope = { uid: 'u1', congregationId: 'c1' };
  const records = Array.from({ length: 25 }, (_, index) => ({
    intent: { congregationId: 'c1', meetingId: 'm1', requestId: String(index), assignmentData: {}, assignedByName: '' },
    confirmed: false, createdAt: index,
  }));
  jest.mocked(readPendingAssignments).mockResolvedValue(records);
  const callable = jest.fn().mockRejectedValueOnce(new Error('Disconnected'))
    .mockResolvedValue({ data: { saved: true } });
  jest.mocked(httpsCallable).mockReturnValue(Object.assign(callable, { stream: jest.fn() }));

  await expect(reconcileAssignmentIntents(scope)).rejects.toThrow('Disconnected');
  expect(callable).toHaveBeenCalledTimes(25);
  expect(markAssignmentConfirmed).toHaveBeenCalledTimes(24);
  expect(markAssignmentConfirmed).toHaveBeenLastCalledWith(scope, '24');
});
