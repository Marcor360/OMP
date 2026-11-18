import { getDocsFromCache, getDocsFromServer, type Query, type QuerySnapshot } from 'firebase/firestore';

import { getQueryCacheFirst } from '@/src/services/repositories/firestore-cache-first';
import { clearAllSessionCache } from '@/src/services/repositories/session-cache';

jest.mock('firebase/firestore', () => ({
  getDocsFromCache: jest.fn(),
  getDocsFromServer: jest.fn(),
}));
jest.mock('@/src/services/firebase/firestore-debug', () => ({ logFirestoreRead: jest.fn() }));
jest.mock('@/src/services/repositories/persistent-cache', () => ({}));

const local = jest.mocked(getDocsFromCache);
const server = jest.mocked(getDocsFromServer);
const read = () => getQueryCacheFirst({
  cacheKey: 'test',
  query: {} as Query,
  persist: false,
  mapSnapshot: (snapshot) => snapshot.docs.map((doc) => doc.id),
});

afterEach(() => {
  jest.resetAllMocks();
  clearAllSessionCache();
});

it('reads the server when the local SDK query cache is empty', async () => {
  local.mockResolvedValue({ empty: true, docs: [] } as unknown as QuerySnapshot);
  server.mockResolvedValue({ docs: [{ id: 'existing' }] } as unknown as QuerySnapshot);

  await expect(read()).resolves.toEqual(['existing']);
  expect(server).toHaveBeenCalledTimes(1);
});

it('keeps the empty local fallback offline and reads again after reconnection', async () => {
  local.mockResolvedValue({ empty: true, docs: [] } as unknown as QuerySnapshot);
  server.mockRejectedValueOnce(Object.assign(new Error('offline'), { code: 'unavailable' }));
  server.mockResolvedValueOnce({ docs: [{ id: 'existing' }] } as unknown as QuerySnapshot);

  await expect(read()).resolves.toEqual([]);
  await expect(read()).resolves.toEqual(['existing']);
});

it('reports permission errors when the only local result is an unchecked empty cache', async () => {
  local.mockResolvedValue({ empty: true, docs: [] } as unknown as QuerySnapshot);
  const denied = Object.assign(new Error('denied'), { code: 'permission-denied' });
  server.mockRejectedValue(denied);

  await expect(read()).rejects.toBe(denied);
});
