import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  CleaningAssignableUser,
  CleaningGroup,
} from '@/src/modules/cleaning/types/cleaning-group.types';

const CACHE_SCHEMA_VERSION = 1;
const GROUPS_CACHE_PREFIX = '@cleaning_groups';
const USERS_CACHE_PREFIX = '@cleaning_assignable_users';

export interface CleaningCacheScope {
  uid: string;
  congregationId: string;
}

interface ScopedCacheEnvelope<T> {
  version: number;
  scope: CleaningCacheScope;
  value: T[];
  updatedAt: number;
}

export interface ScopedCleaningCacheSnapshot {
  groups: CleaningGroup[];
  assignableUsers: CleaningAssignableUser[];
}

export const createCleaningCacheScope = (
  uid: string | null | undefined,
  congregationId: string | null | undefined
): CleaningCacheScope | null => {
  const normalizedUid = uid?.trim() ?? '';
  const normalizedCongregationId = congregationId?.trim() ?? '';

  if (!normalizedUid || !normalizedCongregationId) return null;

  return {
    uid: normalizedUid,
    congregationId: normalizedCongregationId,
  };
};

export const getCleaningCacheScopeIdentity = (scope: CleaningCacheScope): string =>
  `${encodeURIComponent(scope.uid)}:${encodeURIComponent(scope.congregationId)}`;

export const getCleaningCacheStorageKeys = (
  scope: CleaningCacheScope
): { groups: string; assignableUsers: string } => {
  const identity = getCleaningCacheScopeIdentity(scope);

  return {
    groups: `${GROUPS_CACHE_PREFIX}:v${CACHE_SCHEMA_VERSION}:${identity}`,
    assignableUsers: `${USERS_CACHE_PREFIX}:v${CACHE_SCHEMA_VERSION}:${identity}`,
  };
};

export const serializeCleaningCacheValue = <T>(
  scope: CleaningCacheScope,
  value: T[],
  updatedAt = Date.now()
): string =>
  JSON.stringify({
    version: CACHE_SCHEMA_VERSION,
    scope,
    value,
    updatedAt,
  } satisfies ScopedCacheEnvelope<T>);

export const parseCleaningCacheValue = <T>(
  raw: string | null,
  expectedScope: CleaningCacheScope
): T[] | null => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ScopedCacheEnvelope<T>>;
    const storedScope = parsed.scope;

    if (
      parsed.version !== CACHE_SCHEMA_VERSION ||
      !storedScope ||
      storedScope.uid !== expectedScope.uid ||
      storedScope.congregationId !== expectedScope.congregationId ||
      !Array.isArray(parsed.value)
    ) {
      return null;
    }

    return parsed.value;
  } catch {
    return null;
  }
};

export const readScopedCleaningCache = async (
  scope: CleaningCacheScope
): Promise<ScopedCleaningCacheSnapshot> => {
  const keys = getCleaningCacheStorageKeys(scope);
  const [rawGroups, rawUsers] = await Promise.all([
    AsyncStorage.getItem(keys.groups),
    AsyncStorage.getItem(keys.assignableUsers),
  ]);

  return {
    groups: parseCleaningCacheValue<CleaningGroup>(rawGroups, scope) ?? [],
    assignableUsers:
      parseCleaningCacheValue<CleaningAssignableUser>(rawUsers, scope) ?? [],
  };
};

export const writeScopedCleaningGroups = async (
  scope: CleaningCacheScope,
  groups: CleaningGroup[]
): Promise<void> => {
  const key = getCleaningCacheStorageKeys(scope).groups;
  await AsyncStorage.setItem(key, serializeCleaningCacheValue(scope, groups));
};

export const writeScopedCleaningAssignableUsers = async (
  scope: CleaningCacheScope,
  users: CleaningAssignableUser[]
): Promise<void> => {
  const key = getCleaningCacheStorageKeys(scope).assignableUsers;
  await AsyncStorage.setItem(key, serializeCleaningCacheValue(scope, users));
};
