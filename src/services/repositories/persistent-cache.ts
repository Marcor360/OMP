import AsyncStorage from '@react-native-async-storage/async-storage';

type PersistentCacheEntry<T> = {
  value: T;
  updatedAt: number;
  cycleKey: string;
};

type PersistentCacheMeta = {
  cycleKey: string;
  schemaVersion: number;
  updatedAt: number;
};

type PersistentCacheStoredEntry = {
  updatedAt?: unknown;
  cycleKey?: unknown;
};

const PERSISTENT_CACHE_PREFIX = 'omp:persistent-cache:';
const PERSISTENT_CACHE_META_KEY = `${PERSISTENT_CACHE_PREFIX}meta`;
const CACHE_SCHEMA_VERSION = 1;
const MAX_PERSISTENT_CACHE_ENTRIES = 300;
const MAX_PERSISTENT_CACHE_ENTRY_BYTES = 250 * 1024;

let initializationPromise: Promise<void> | null = null;

export const getAnnualCacheCycleKey = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const startYear = month >= 8 ? year : year - 1;

  return `${startYear}-${startYear + 1}`;
};

export const buildCongregationCacheKey = (
  congregationId: string,
  key: string
): string => `congregation:${congregationId}:${key}`;

export const buildUserCacheKey = (
  uid: string,
  key: string
): string => `user:${uid}:${key}`;

const warnPersistentCacheError = (operation: string, error: unknown): void => {
  if (__DEV__) {
    console.warn(`[persistent-cache] ${operation}`, error);
  }
};

const debugPersistentCache = (message: string, key?: string): void => {
  if (__DEV__) {
    console.debug(`[persistent-cache] ${message}${key ? ` ${key}` : ''}`);
  }
};

const toStorageKey = (key: string): string => `${PERSISTENT_CACHE_PREFIX}${key}`;

const isPersistentCacheStorageKey = (key: string): boolean =>
  key.startsWith(PERSISTENT_CACHE_PREFIX);

const isMetaStorageKey = (key: string): boolean => key === PERSISTENT_CACHE_META_KEY;

const normalizeLayerCacheKey = (key: string): string => {
  const userProfileMatch = /^doc:users\/([^/]+)$/.exec(key);
  if (userProfileMatch) {
    return buildUserCacheKey(userProfileMatch[1], 'profile');
  }

  const congregationUsersMatch = /^query:users\/congregation\/([^/]+)\/(.+)$/.exec(key);
  if (congregationUsersMatch) {
    return buildCongregationCacheKey(
      congregationUsersMatch[1],
      `query:users/${congregationUsersMatch[2]}`
    );
  }

  const congregationDocMatch = /^(doc|query):congregations\/([^/]+)\/(.+)$/.exec(key);
  if (congregationDocMatch) {
    return buildCongregationCacheKey(
      congregationDocMatch[2],
      `${congregationDocMatch[1]}:${congregationDocMatch[3]}`
    );
  }

  const dashboardMatch = /^(doc|query):dashboard-summary\/([^/]+)(?:\/(.+))?$/.exec(key);
  if (dashboardMatch) {
    return buildCongregationCacheKey(
      dashboardMatch[2],
      `${dashboardMatch[1]}:dashboard-summary${dashboardMatch[3] ? `/${dashboardMatch[3]}` : ''}`
    );
  }

  const congregationDomainMatch = /^(doc|query):(meetings|midweek|assignments|assignments-panel|outgoingTalks)\/([^/]+)\/(.+)$/.exec(key);
  if (congregationDomainMatch) {
    return buildCongregationCacheKey(
      congregationDomainMatch[3],
      `${congregationDomainMatch[1]}:${congregationDomainMatch[2]}/${congregationDomainMatch[4]}`
    );
  }

  return key;
};

const normalizeLayerCachePrefix = (prefix: string): string => {
  if (prefix.startsWith('congregation:') || prefix.startsWith('user:')) {
    return prefix;
  }

  const congregationUsersPrefixMatch = /^query:users\/congregation\/([^/]+)\/(.*)$/.exec(prefix);
  if (congregationUsersPrefixMatch) {
    return buildCongregationCacheKey(
      congregationUsersPrefixMatch[1],
      `query:users/${congregationUsersPrefixMatch[2]}`
    );
  }

  const congregationPrefixMatch = /^(doc|query):congregations\/([^/]+)\/(.*)$/.exec(prefix);
  if (congregationPrefixMatch) {
    return buildCongregationCacheKey(
      congregationPrefixMatch[2],
      `${congregationPrefixMatch[1]}:${congregationPrefixMatch[3]}`
    );
  }

  const dashboardPrefixMatch = /^(doc|query):dashboard-summary\/([^/]+)(?:\/(.*))?$/.exec(prefix);
  if (dashboardPrefixMatch) {
    return buildCongregationCacheKey(
      dashboardPrefixMatch[2],
      `${dashboardPrefixMatch[1]}:dashboard-summary${dashboardPrefixMatch[3] ? `/${dashboardPrefixMatch[3]}` : ''}`
    );
  }

  const domainPrefixMatch = /^(doc|query):(meetings|midweek|assignments|assignments-panel|outgoingTalks)\/([^/]+)\/(.*)$/.exec(prefix);
  if (domainPrefixMatch) {
    return buildCongregationCacheKey(
      domainPrefixMatch[3],
      `${domainPrefixMatch[1]}:${domainPrefixMatch[2]}/${domainPrefixMatch[4]}`
    );
  }

  return prefix;
};

const parseJson = <T>(raw: string | null): T | null => {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const estimateSerializedBytes = (value: string): number => {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }

  return value.length;
};

const getPersistentStorageKeys = async (): Promise<string[]> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    return keys.filter(isPersistentCacheStorageKey);
  } catch (error) {
    warnPersistentCacheError('getAllKeys', error);
    return [];
  }
};

const enforcePersistentCacheLimit = async (): Promise<void> => {
  try {
    const keys = (await getPersistentStorageKeys()).filter((key) => !isMetaStorageKey(key));
    if (keys.length <= MAX_PERSISTENT_CACHE_ENTRIES) return;

    const pairs = await AsyncStorage.multiGet(keys);
    const entries = pairs.map(([storageKey, raw]) => {
      const entry = parseJson<PersistentCacheStoredEntry>(raw);
      const updatedAt = typeof entry?.updatedAt === 'number' ? entry.updatedAt : 0;
      return { storageKey, updatedAt };
    });
    const keysToRemove = entries
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .slice(0, Math.max(0, entries.length - MAX_PERSISTENT_CACHE_ENTRIES))
      .map((entry) => entry.storageKey);

    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
      debugPersistentCache('limit-pruned', String(keysToRemove.length));
    }
  } catch (error) {
    warnPersistentCacheError('enforce limit', error);
  }
};

export const clearAllPersistentCache = async (): Promise<void> => {
  try {
    const keys = await getPersistentStorageKeys();

    if (keys.length > 0) {
      await AsyncStorage.multiRemove(keys);
    }
  } catch (error) {
    warnPersistentCacheError('clear all', error);
  }
};

export const initializePersistentCacheCycle = async (): Promise<void> => {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      const currentCycleKey = getAnnualCacheCycleKey();
      const meta = parseJson<PersistentCacheMeta>(
        await AsyncStorage.getItem(PERSISTENT_CACHE_META_KEY)
      );
      const shouldReset =
        meta?.cycleKey !== currentCycleKey ||
        meta?.schemaVersion !== CACHE_SCHEMA_VERSION;

      if (shouldReset) {
        await clearAllPersistentCache();
        debugPersistentCache('annual reset', currentCycleKey);
      }

      await AsyncStorage.setItem(
        PERSISTENT_CACHE_META_KEY,
        JSON.stringify({
          cycleKey: currentCycleKey,
          schemaVersion: CACHE_SCHEMA_VERSION,
          updatedAt: Date.now(),
        } satisfies PersistentCacheMeta)
      );
    } catch (error) {
      warnPersistentCacheError('initialize', error);
    }
  })().finally(() => {
    initializationPromise = null;
  });

  return initializationPromise;
};

export const getPersistentCachedValue = async <T>(
  key: string,
  maxAgeMs?: number
): Promise<T | undefined> => {
  try {
    await initializePersistentCacheCycle();

    const normalizedKey = normalizeLayerCacheKey(key);
    const storageKey = toStorageKey(normalizedKey);
    const entry = parseJson<PersistentCacheEntry<T>>(await AsyncStorage.getItem(storageKey));
    const currentCycleKey = getAnnualCacheCycleKey();

    if (!entry || entry.cycleKey !== currentCycleKey) {
      if (entry) {
        await AsyncStorage.removeItem(storageKey);
      }
      debugPersistentCache('miss', normalizedKey);
      return undefined;
    }

    if (
      typeof maxAgeMs === 'number' &&
      Number.isFinite(maxAgeMs) &&
      maxAgeMs > 0 &&
      Date.now() - entry.updatedAt > maxAgeMs
    ) {
      await AsyncStorage.removeItem(storageKey);
      debugPersistentCache('expired', normalizedKey);
      return undefined;
    }

    debugPersistentCache('hit', normalizedKey);
    return entry.value;
  } catch (error) {
    warnPersistentCacheError('get', error);
    return undefined;
  }
};

export const setPersistentCachedValue = async <T>(
  key: string,
  value: T
): Promise<void> => {
  try {
    await initializePersistentCacheCycle();

    const normalizedKey = normalizeLayerCacheKey(key);
    const entry: PersistentCacheEntry<T> = {
      value,
      updatedAt: Date.now(),
      cycleKey: getAnnualCacheCycleKey(),
    };
    const serialized = JSON.stringify(entry);

    if (estimateSerializedBytes(serialized) > MAX_PERSISTENT_CACHE_ENTRY_BYTES) {
      warnPersistentCacheError(
        'skip too large',
        `${normalizedKey} exceeds ${MAX_PERSISTENT_CACHE_ENTRY_BYTES} bytes`
      );
      return;
    }

    await AsyncStorage.setItem(toStorageKey(normalizedKey), serialized);
    await enforcePersistentCacheLimit();
  } catch (error) {
    warnPersistentCacheError('set', error);
  }
};

export const clearPersistentCachedValue = async (key: string): Promise<void> => {
  try {
    const normalizedKey = normalizeLayerCacheKey(key);
    const keys = Array.from(new Set([toStorageKey(key), toStorageKey(normalizedKey)]));

    await AsyncStorage.multiRemove(keys);
  } catch (error) {
    warnPersistentCacheError('clear value', error);
  }
};

export const clearPersistentCacheByPrefix = async (prefix: string): Promise<void> => {
  if (!prefix) return;

  try {
    const normalizedPrefix = normalizeLayerCachePrefix(prefix);
    const storagePrefixes = Array.from(
      new Set([toStorageKey(prefix), toStorageKey(normalizedPrefix)])
    );
    const shouldRemoveNormalizedUsersQuery =
      prefix === 'query:users/' || prefix === 'query:users';

    const keys = await getPersistentStorageKeys();
    const keysToRemove = keys
      .filter((key) => !isMetaStorageKey(key))
      .filter((key) =>
        storagePrefixes.some((storagePrefix) => key.startsWith(storagePrefix)) ||
        (shouldRemoveNormalizedUsersQuery && key.includes(':query:users/'))
      );

    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
    }
  } catch (error) {
    warnPersistentCacheError('clear prefix', error);
  }
};
