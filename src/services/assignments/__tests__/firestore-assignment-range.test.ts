import { Timestamp } from 'firebase/firestore';

import { getQueryCacheFirst } from '@/src/services/repositories/firestore-cache-first';
import { firestoreAssignmentRepository } from '@/src/services/repositories/firestore/firestore-assignment-repository';

jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('@/src/services/assignments/pending-assignment-store', () => ({
  forgetAssignmentIntent: jest.fn(),
  rememberAssignmentIntent: jest.fn(),
}));
jest.mock('@/src/lib/firebase/app', () => ({ db: {}, functions: {} }));
jest.mock('@/src/lib/firebase/refs', () => ({
  congregationMeetingsCollectionRef: jest.fn(),
  meetingAssignmentsCollectionRef: jest.fn(),
}));
jest.mock('firebase/firestore', () => ({
  Timestamp: { fromDate: (value: Date) => ({ toMillis: () => value.getTime() }) },
  limit: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
}));
jest.mock('@/src/services/repositories/firestore-cache-first', () => ({
  getQueryCacheFirst: jest.fn(),
}));

const read = jest.mocked(getQueryCacheFirst);
const date = (day: number) => new Date(Date.UTC(2027, 0, day));
const options = { userUid: 'u1', status: 'pending' as const };

afterEach(() => jest.resetAllMocks());

it('reuses the fallback query for overlapping ranges and filters results for each range', async () => {
  const fallbackReads = new Map<string, unknown[]>();
  let misses = 0;
  read.mockImplementation(async ({ cacheKey }) => {
    if (cacheKey.includes('/meeting-ids/')) return ['meeting1'];
    if (!cacheKey.includes('/range-fallback/')) throw { code: 'failed-precondition' };
    if (!fallbackReads.has(cacheKey)) {
      misses += 1;
      fallbackReads.set(cacheKey, [
        { id: 'first', dueDate: Timestamp.fromDate(date(4)) },
        { id: 'second', dueDate: Timestamp.fromDate(date(6)) },
      ]);
    }
    return fallbackReads.get(cacheKey);
  });

  await expect(firestoreAssignmentRepository.getByRange('c1', date(1), date(5), options))
    .resolves.toMatchObject([{ id: 'first' }]);
  await expect(firestoreAssignmentRepository.getByRange('c1', date(3), date(8), options))
    .resolves.toMatchObject([{ id: 'first' }, { id: 'second' }]);
  expect(misses).toBe(1);

  await firestoreAssignmentRepository.getByRange('c1', date(3), date(8), {
    ...options, userUid: 'u2',
  });
  expect(misses).toBe(2);
});

it('propagates permission failures without attempting the broader fallback', async () => {
  const error = { code: 'permission-denied' };
  read.mockResolvedValueOnce(['meeting1']).mockRejectedValueOnce(error);

  await expect(firestoreAssignmentRepository.getByRange('c1', date(1), date(5), options))
    .rejects.toBe(error);
  expect(read).toHaveBeenCalledTimes(2);
});
