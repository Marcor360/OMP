import { getDocsFromCache, getDocsFromServer, type Query, type QuerySnapshot } from 'firebase/firestore';

import { getQueryCacheFirst, invalidateCacheEntry } from '@/src/services/repositories/firestore-cache-first';
import { setPersistentCachedValue } from '@/src/services/repositories/persistent-cache';
import { clearAllSessionCache } from '@/src/services/repositories/session-cache';

jest.mock('firebase/firestore', () => ({
  getDocsFromCache: jest.fn(),
  getDocsFromServer: jest.fn(),
}));
jest.mock('@/src/services/firebase/firestore-debug', () => ({ logFirestoreRead: jest.fn() }));
jest.mock('@/src/services/repositories/persistent-cache', () => ({
  clearPersistentCachedValue: jest.fn(),
  getPersistentCachedValue: jest.fn(),
  setPersistentCachedValue: jest.fn(),
}));

const local = jest.mocked(getDocsFromCache);
const server = jest.mocked(getDocsFromServer);
const read = (persist = false, allowUnverifiedEmpty = true) => getQueryCacheFirst({
  cacheKey: 'test',
  query: {} as Query,
  persist,
  allowUnverifiedEmpty,
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

it('propagates connection errors when an unverified empty result is disabled', async () => {
  local.mockResolvedValue({ empty: true, docs: [] } as unknown as QuerySnapshot);
  const offline = Object.assign(new Error('offline'), { code: 'unavailable' });
  server.mockRejectedValue(offline);

  await expect(read(false, false)).rejects.toBe(offline);
});

it('reuses fresh session results and requires the server on expiry or manual refresh', async () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
  const refresh = (forceServer = false) => getQueryCacheFirst({
    cacheKey: 'reports',
    query: {} as Query,
    persist: false,
    maxAgeMs: 60_000,
    forceServer,
    requireServerOnCacheMiss: true,
    mapSnapshot: (snapshot) => snapshot.docs.map((doc) => doc.id),
  });
  const offline = Object.assign(new Error('offline'), { code: 'unavailable' });
  server.mockResolvedValueOnce({ docs: [{ id: 'initial' }] } as unknown as QuerySnapshot)
    .mockRejectedValueOnce(offline)
    .mockResolvedValueOnce({ docs: [{ id: 'updated' }] } as unknown as QuerySnapshot);

  try {
    await expect(refresh()).resolves.toEqual(['initial']);
    await expect(refresh()).resolves.toEqual(['initial']);
    await expect(refresh(true)).rejects.toBe(offline);
    now.mockReturnValue(61_001);
    await expect(refresh()).resolves.toEqual(['updated']);
    expect(server).toHaveBeenCalledTimes(3);
    expect(local).not.toHaveBeenCalled();
  } finally {
    now.mockRestore();
  }
});

it.each([
  ['explicit invalidation', () => invalidateCacheEntry('test')],
  ['session cleanup', clearAllSessionCache],
])('prevents an older response from restoring the cache after %s', async (_reason, invalidate) => {
  let completeOldRead!: (result: QuerySnapshot) => void;
  let notifyOldReadStarted!: () => void;
  const oldReadStarted = new Promise<void>((resolve) => {
    notifyOldReadStarted = resolve;
  });
  local.mockResolvedValue({ empty: true, docs: [] } as unknown as QuerySnapshot);
  server.mockImplementationOnce(() => new Promise<QuerySnapshot>((resolve) => {
    completeOldRead = resolve;
    notifyOldReadStarted();
  }));
  server.mockResolvedValueOnce({ docs: [{ id: 'fresh' }] } as unknown as QuerySnapshot);

  const oldRead = read(true);
  await oldReadStarted;
  await invalidate();
  await expect(read(true)).resolves.toEqual(['fresh']);

  completeOldRead({ docs: [{ id: 'outdated' }] } as unknown as QuerySnapshot);

  await expect(oldRead).resolves.toEqual(['outdated']);
  await expect(read()).resolves.toEqual(['fresh']);
  expect(setPersistentCachedValue).toHaveBeenCalledTimes(1);
  expect(setPersistentCachedValue).toHaveBeenCalledWith('query:test', ['fresh'], expect.any(Function));
});
