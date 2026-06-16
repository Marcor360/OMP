/* eslint-disable import/first */
const mockStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      mockStorage.delete(key);
      return Promise.resolve();
    }),
    getAllKeys: jest.fn(() => Promise.resolve(Array.from(mockStorage.keys()))),
    multiRemove: jest.fn((keys: string[]) => {
      keys.forEach((key) => mockStorage.delete(key));
      return Promise.resolve();
    }),
    multiGet: jest.fn((keys: string[]) =>
      Promise.resolve(keys.map((key) => [key, mockStorage.get(key) ?? null]))
    ),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
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
    await clearAllPersistentCache();
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
    await AsyncStorage.setItem('external:key', 'keep');
    await setPersistentCachedValue('doc:users/u1', { name: 'Marco' });

    await expect(getPersistentCachedValue<{ name: string }>('doc:users/u1')).resolves.toEqual({
      name: 'Marco',
    });

    await clearPersistentCachedValue('doc:users/u1');
    await expect(getPersistentCachedValue('doc:users/u1')).resolves.toBeUndefined();
    await expect(AsyncStorage.getItem('external:key')).resolves.toBe('keep');
  });

  it('expires values by max age', async () => {
    jest.spyOn(Date, 'now').mockReturnValueOnce(1_000).mockReturnValueOnce(5_000);

    await setPersistentCachedValue('query:dashboard-summary/c1', { count: 1 });

    await expect(
      getPersistentCachedValue('query:dashboard-summary/c1', 1_000)
    ).resolves.toBeUndefined();
  });

  it('clears normalized congregation prefixes only', async () => {
    await setPersistentCachedValue('query:meetings/c1/week/current', ['m1']);
    await setPersistentCachedValue('query:meetings/c2/week/current', ['m2']);

    await clearPersistentCacheByPrefix('congregation:c1:');

    await expect(getPersistentCachedValue('query:meetings/c1/week/current')).resolves.toBeUndefined();
    await expect(getPersistentCachedValue('query:meetings/c2/week/current')).resolves.toEqual(['m2']);
  });
});
