import { act, renderHook } from '@testing-library/react-native';

import { useAssignments } from '../useAssignments';
import { getMeetingPanelAssignments, listStandaloneAssignments } from '../../services/assignments.service';
import type { Assignment, AssignmentFilters } from '../../types/assignment.types';

jest.mock('@/src/hooks/use-refresh-on-focus', () => ({
  useRefreshOnFocus: (callback: () => void) => jest.requireActual('react').useEffect(callback, [callback]),
}));
jest.mock('../../services/assignments.service', () => ({
  getMeetingPanelAssignments: jest.fn(),
  listStandaloneAssignments: jest.fn(),
  mergePanelAssignments: (...sources: Assignment[][]) => sources.flat(),
}));

const meetings = jest.mocked(getMeetingPanelAssignments);
const standalone = jest.mocked(listStandaloneAssignments);
const row = (id: string, date: string): Assignment => ({
  id, sourceKey: id, source: 'meeting', congregationId: 'c1', category: 'midweek',
  subType: null, meetingType: 'midweek', date, assignedUsers: [{ userId: 'u1', name: 'Test' }],
});
const filters = (exactDate = ''): AssignmentFilters => ({
  exactDate, rangeStart: '', rangeEnd: '', category: 'all', subType: 'all', assignedPerson: '',
  congregationId: 'c1', status: 'all',
});

afterEach(() => jest.resetAllMocks());

it('preserves meeting data and retries only the failed source', async () => {
  meetings.mockResolvedValue([row('meeting', '2026-11-19')]);
  standalone.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce([row('standalone', '2026-11-19')]);
  const { result } = await renderHook(() => useAssignments({ congregationId: 'c1', uid: 'u1', filters: filters() }));
  await act(async () => undefined);
  expect(result.current.partialError).toBe(true);
  expect(result.current.assignments.map((item) => item.id)).toEqual(['meeting']);

  await act(async () => { await result.current.retryFailed(); });
  expect(meetings).toHaveBeenCalledTimes(1);
  expect(standalone).toHaveBeenCalledTimes(2);
  expect(result.current.partialError).toBe(false);
  expect(result.current.assignments.map((item) => item.id)).toEqual(['meeting', 'standalone']);
});

it('discards a slow response from an older date range', async () => {
  let finishOld: (data: Assignment[]) => void = () => undefined;
  meetings.mockReturnValueOnce(new Promise((resolve) => { finishOld = resolve; }))
    .mockResolvedValueOnce([row('new', '2026-11-20')]);
  standalone.mockResolvedValue([]);
  const { result, rerender } = await renderHook(
    ({ day }: { day: string }) => useAssignments({ congregationId: 'c1', uid: 'u1', filters: filters(day) }),
    { initialProps: { day: '2026-11-19' } },
  );
  await rerender({ day: '2026-11-20' });
  expect(result.current.allAssignments.map((item) => item.id)).toEqual(['new']);

  await act(async () => { finishOld([row('old', '2026-11-19')]); });
  expect(result.current.allAssignments.map((item) => item.id)).toEqual(['new']);
});
