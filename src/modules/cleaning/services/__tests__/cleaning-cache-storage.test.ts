import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CleaningGroup } from '../../types/cleaning-group.types';
import {
  createCleaningCacheScope,
  getCleaningCacheStorageKeys,
  parseCleaningCacheValue,
  readScopedCleaningCache,
  serializeCleaningCacheValue,
  writeScopedCleaningGroups,
} from '../cleaning-cache-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('cleaning-cache-storage scoped', () => {
  let backingStore: Map<string, string>;

  beforeEach(() => {
    backingStore = new Map<string, string>();
    mockAsyncStorage.getItem.mockImplementation(
      async (key: string) => backingStore.get(key) ?? null
    );
    mockAsyncStorage.setItem.mockImplementation(async (key: string, value: string) => {
      backingStore.set(key, value);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('requiere uid y congregationId y normaliza espacios', () => {
    expect(createCleaningCacheScope('', 'cong-1')).toBeNull();
    expect(createCleaningCacheScope('user-a', null)).toBeNull();
    expect(createCleaningCacheScope(' user-a ', ' cong-1 ')).toEqual({
      uid: 'user-a',
      congregationId: 'cong-1',
    });
  });

  it('construye claves distintas por usuario y congregacion', () => {
    const userA = createCleaningCacheScope('user-a', 'cong-1')!;
    const userB = createCleaningCacheScope('user-b', 'cong-1')!;
    const otherCongregation = createCleaningCacheScope('user-a', 'cong-2')!;

    const keysA = getCleaningCacheStorageKeys(userA);
    const keysB = getCleaningCacheStorageKeys(userB);
    const keysOtherCongregation = getCleaningCacheStorageKeys(otherCongregation);

    expect(keysA.groups).not.toBe(keysB.groups);
    expect(keysA.groups).not.toBe(keysOtherCongregation.groups);
    expect(keysA.groups).not.toBe('@cleaning_groups');
    expect(keysA.assignableUsers).not.toBe('@cleaning_assignable_users');
  });

  it('rechaza un envelope aunque se lea bajo un scope diferente', () => {
    const userA = createCleaningCacheScope('user-a', 'cong-1')!;
    const userB = createCleaningCacheScope('user-b', 'cong-1')!;
    const serialized = serializeCleaningCacheValue(userA, [{ id: 'group-a' }]);

    expect(parseCleaningCacheValue(serialized, userA)).toEqual([{ id: 'group-a' }]);
    expect(parseCleaningCacheValue(serialized, userB)).toBeNull();
    expect(parseCleaningCacheValue('{invalid-json', userA)).toBeNull();
  });

  it('preserva A y B por separado y rehidrata A intacto despues de A -> B -> A', async () => {
    const userA = createCleaningCacheScope('user-a', 'cong-1')!;
    const userB = createCleaningCacheScope('user-b', 'cong-1')!;
    const groupA = { id: 'group-a', name: 'Grupo A' } as CleaningGroup;
    const groupB = { id: 'group-b', name: 'Grupo B' } as CleaningGroup;

    await writeScopedCleaningGroups(userA, [groupA]);
    await writeScopedCleaningGroups(userB, [groupB]);

    const cacheB = await readScopedCleaningCache(userB);
    const cacheA = await readScopedCleaningCache(userA);

    expect(cacheB.groups).toEqual([groupB]);
    expect(cacheB.groups).not.toContainEqual(groupA);
    expect(cacheA.groups).toEqual([groupA]);
    expect(backingStore.has(getCleaningCacheStorageKeys(userA).groups)).toBe(true);
    expect(backingStore.has(getCleaningCacheStorageKeys(userB).groups)).toBe(true);
  });
});
