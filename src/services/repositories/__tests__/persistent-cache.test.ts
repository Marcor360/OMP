/* eslint-disable import/first */
import type { PersistentBlobStore } from '@/src/services/repositories/ports/persistent-blob-store';

const mockStorage = new Map<string, string>();
const mockStore: PersistentBlobStore = {
  maxEntryBytes: 250 * 1024,
  maxEntries: 300,
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  }),
  removeItems: jest.fn((keys: string[]) => {
    keys.forEach((key) => mockStorage.delete(key));
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() =>
    Promise.resolve(Array.from(mockStorage.keys()).filter((key) => key !== 'external:key'))
  ),
  multiGet: jest.fn((keys: string[]) =>
    Promise.resolve(keys.map((key) => [key, mockStorage.get(key) ?? null]))
  ),
};

import {
  __setPersistentBlobStoreForTests,
  buildCongregationCacheKey,
  buildUserCacheKey,
  clearAllPersistentCache,
  clearPersistentCacheByPrefix,
  clearPersistentCachedValue,
  getAnnualCacheCycleKey,
  getPersistentCachedValue,
  setPersistentCachedValue,
} from '@/src/services/repositories/persistent-cache';

describe('persistent cache', () => {
  beforeEach(async () => {
    mockStorage.clear();
    jest.clearAllMocks();
    Object.defineProperty(mockStore, 'maxEntryBytes', {
      configurable: true,
      value: 250 * 1024,
    });
    Object.defineProperty(mockStore, 'maxEntries', {
      configurable: true,
      value: 300,
    });
    __setPersistentBlobStoreForTests(mockStore);
    await clearAllPersistentCache();
  });

  it('calculates annual cycles from September to August', () => {
    expect(getAnnualCacheCycleKey(new Date(2026, 7, 31))).toBe('2025-2026');
    expect(getAnnualCacheCycleKey(new Date(2026, 8, 1))).toBe('2026-2027');
    expect(getAnnualCacheCycleKey(new Date(2027, 0, 10))).toBe('2026-2027');
  });

  it('builds scoped cache keys for congregations and users', () => {
    expect(buildCongregationCacheKey('c1', 'query:users/active')).toBe(
      'congregation:c1:query:users/active'
    );
    expect(buildUserCacheKey('u1', 'profile')).toBe('user:u1:profile');
  });

  it('stores, reads and clears a value without touching external keys', async () => {
    mockStorage.set('external:key', 'keep');
    await setPersistentCachedValue('doc:users/u1', { name: 'Marco' });

    await expect(getPersistentCachedValue<{ name: string }>('doc:users/u1')).resolves.toEqual({
      name: 'Marco',
    });

    await clearPersistentCachedValue('doc:users/u1');
    await expect(getPersistentCachedValue('doc:users/u1')).resolves.toBeUndefined();
    expect(mockStorage.get('external:key')).toBe('keep');
  });

  it('expires values by max age', async () => {
    const dateNowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(5_000);

    await setPersistentCachedValue('query:dashboard-summary/c1', { count: 1 });

    await expect(
      getPersistentCachedValue('query:dashboard-summary/c1', 1_000)
    ).resolves.toBeUndefined();
    dateNowSpy.mockRestore();
  });

  it('clears normalized congregation prefixes only', async () => {
    await setPersistentCachedValue('query:meetings/c1/week/current', ['m1']);
    await setPersistentCachedValue('query:meetings/c2/week/current', ['m2']);

    await clearPersistentCacheByPrefix('congregation:c1:');

    await expect(getPersistentCachedValue('query:meetings/c1/week/current')).resolves.toBeUndefined();
    await expect(getPersistentCachedValue('query:meetings/c2/week/current')).resolves.toEqual(['m2']);
  });

  it('persists and recovers a 500 KB entry with native limits', async () => {
    Object.defineProperty(mockStore, 'maxEntryBytes', { value: 2 * 1024 * 1024 });
    const payload = 'n'.repeat(500 * 1024);

    await setPersistentCachedValue('query:meetings/c1/large', payload);

    await expect(getPersistentCachedValue('query:meetings/c1/large')).resolves.toBe(payload);
  });

  it('discards a 500 KB entry with web limits', async () => {
    const payload = 'w'.repeat(500 * 1024);

    await setPersistentCachedValue('query:meetings/c1/large', payload);

    await expect(getPersistentCachedValue('query:meetings/c1/large')).resolves.toBeUndefined();
    expect(mockStore.setItem).not.toHaveBeenCalledWith(
      'congregation:c1:query:meetings/large',
      expect.stringContaining(payload)
    );
  });
});
