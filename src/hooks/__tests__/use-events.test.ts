import { act, renderHook } from '@testing-library/react-native';

import { getActiveEvents } from '@/src/services/events/events-service';
import type { CongregationEvent } from '@/src/types/event';
import { useEvents } from '../use-events';

jest.mock('@/src/services/events/events-service', () => ({ getActiveEvents: jest.fn() }));

it('keeps the last list through a failed refresh and clears it on account change', async () => {
  const events = [{ id: 'assembly' }] as CongregationEvent[];
  jest.mocked(getActiveEvents).mockResolvedValueOnce(events).mockRejectedValue(new Error('Offline'));
  const { result, rerender } = await renderHook(
    ({ uid }: { uid: string }) => useEvents('congregation', uid),
    { initialProps: { uid: 'first' } },
  );

  await act(async () => { await result.current.refresh(); });
  expect(result.current.events).toEqual(events);
  expect(result.current.error).toBeTruthy();

  await rerender({ uid: 'second' });
  expect(result.current.events).toEqual([]);
  expect(result.current.error).toBeTruthy();

  jest.mocked(getActiveEvents).mockResolvedValueOnce([]);
  await act(async () => { await result.current.refresh(); });
  expect(result.current.events).toEqual([]);
  expect(result.current.error).toBeNull();
});
