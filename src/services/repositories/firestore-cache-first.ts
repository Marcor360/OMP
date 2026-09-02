import {
  type DocumentData,
  type DocumentReference,
  type Query,
  type QuerySnapshot,
  getDocFromCache,
  getDocFromServer,
  getDocsFromCache,
  getDocsFromServer,
} from 'firebase/firestore';

import { logFirestoreRead } from '@/src/services/firebase/firestore-debug';
import {
  getPersistentCachedValue,
  clearPersistentCachedValue,
  setPersistentCachedValue,
} from '@/src/services/repositories/persistent-cache';
import {
  clearSessionCachedValue,
  getSessionCachedValue,
  runSingleFlight,
  setSessionCachedValue,
} from '@/src/services/repositories/session-cache';

const CACHE_MISS = Symbol('CACHE_MISS');
const SESSION_BOUNDARY_CACHE_BYPASS_MS = 15 * 1000;

type CacheMiss = typeof CACHE_MISS;

let localCacheBypassUntil = 0;

export const markFirestoreCacheSessionBoundary = (
  durationMs = SESSION_BOUNDARY_CACHE_BYPASS_MS
): void => {
  localCacheBypassUntil = Math.max(localCacheBypassUntil, Date.now() + durationMs);
};

const shouldBypassLocalCache = (): boolean => Date.now() < localCacheBypassUntil;

interface CacheFirstDocumentOptions<T> {
  cacheKey: string;
  ref: DocumentReference<DocumentData>;
  mapSnapshot: (snapshot: { id: string; data: () => DocumentData | undefined }) => T;
  maxAgeMs?: number;
  forceServer?: boolean;
  isIncomplete?: (value: T) => boolean;
  persist?: boolean;
}

interface CacheFirstQueryOptions<T> {
  cacheKey: string;
  query: Query<DocumentData>;
  mapSnapshot: (snapshot: QuerySnapshot<DocumentData>) => T;
  maxAgeMs?: number;
  forceServer?: boolean;
  isIncomplete?: (value: T) => boolean;
  persist?: boolean;
}

const isValueIncomplete = <T>(
  value: T,
  isIncomplete?: (candidate: T) => boolean
): boolean => {
  if (!isIncomplete) return false;
  return isIncomplete(value);
};

const isUsableDocumentValue = <T>(
  value: T | null | undefined,
  isIncomplete?: (candidate: T) => boolean
): value is T | null => {
  if (value === undefined) return false;
  return !(value !== null && isValueIncomplete(value, isIncomplete));
};

const setCacheLayers = async <T>(
  layerCacheKey: string,
  value: T,
  persist: boolean
): Promise<void> => {
  setSessionCachedValue(layerCacheKey, value);

  if (persist) {
    await setPersistentCachedValue(layerCacheKey, value);
  }
};

const setValidCacheLayers = async <T>(
  layerCacheKey: string,
  value: T,
  persist: boolean,
  isIncomplete?: (candidate: T) => boolean
): Promise<void> => {
  if (!isValueIncomplete(value, isIncomplete)) {
    await setCacheLayers(layerCacheKey, value, persist);
  }
};

export const getDocumentCacheFirst = async <T>(
  options: CacheFirstDocumentOptions<T>
): Promise<T | null> => {
  const {
    cacheKey,
    ref,
    mapSnapshot,
    maxAgeMs,
    forceServer: requestedForceServer = false,
    isIncomplete,
    persist = true,
  } = options;
  const skipLocalCacheRead = shouldBypassLocalCache();
  const forceServer = requestedForceServer || skipLocalCacheRead;
  const memoryCacheKey = `doc:${cacheKey}`;
  const requestKey = `request:${memoryCacheKey}`;
  const fallbackMemoryValue = getSessionCachedValue<T | null>(memoryCacheKey);

  if (!forceServer) {
    const memoryValue = getSessionCachedValue<T | null>(memoryCacheKey, maxAgeMs);

    if (isUsableDocumentValue(memoryValue, isIncomplete)) {
      logFirestoreRead(cacheKey, 'memory');
      return memoryValue;
    }
  }

  return runSingleFlight<T | null>(requestKey, async () => {
    let cachedValue: T | null | CacheMiss = isUsableDocumentValue(
      fallbackMemoryValue,
      isIncomplete
    )
      ? fallbackMemoryValue
      : CACHE_MISS;

    if (persist) {
      try {
        const persistentValue = await getPersistentCachedValue<T | null>(
          memoryCacheKey,
          maxAgeMs
        );

        if (isUsableDocumentValue(persistentValue, isIncomplete)) {
          cachedValue = persistentValue;
          setSessionCachedValue(memoryCacheKey, persistentValue);

          if (!forceServer) {
            logFirestoreRead(cacheKey, 'persistent');
            return persistentValue;
          }
        }
      } catch {
        // AsyncStorage nunca debe impedir leer desde Firestore.
      }
    }

    if (!skipLocalCacheRead && (!forceServer || cachedValue === CACHE_MISS)) {
      try {
        const cacheSnapshot = await getDocFromCache(ref);
        const localValue = cacheSnapshot.exists() ? mapSnapshot(cacheSnapshot) : null;
        logFirestoreRead(cacheKey, 'cache');

        if (isUsableDocumentValue(localValue, isIncomplete)) {
          cachedValue = localValue;
          await setCacheLayers(memoryCacheKey, localValue, persist);

          if (!forceServer) {
            return localValue;
          }
        }
      } catch {
        // Mantener el mejor fallback disponible.
      }
    }

    try {
      const serverSnapshot = await getDocFromServer(ref);

      if (!serverSnapshot.exists()) {
        await setCacheLayers(memoryCacheKey, null, persist);
        logFirestoreRead(cacheKey, 'server', 'exists=false');
        return null;
      }

      const mappedValue = mapSnapshot(serverSnapshot);
      await setValidCacheLayers(memoryCacheKey, mappedValue, persist, isIncomplete);
      logFirestoreRead(cacheKey, 'server');
      return mappedValue;
    } catch (error) {
      if (cachedValue !== CACHE_MISS) {
        logFirestoreRead(cacheKey, 'server-fallback');
        return cachedValue;
      }

      throw error;
    }
  });
};

export const getQueryCacheFirst = async <T>(
  options: CacheFirstQueryOptions<T>
): Promise<T> => {
  const {
    cacheKey,
    query,
    mapSnapshot,
    maxAgeMs,
    forceServer: requestedForceServer = false,
    isIncomplete,
    persist = true,
  } = options;
  const skipLocalCacheRead = shouldBypassLocalCache();
  const forceServer = requestedForceServer || skipLocalCacheRead;
  const memoryCacheKey = `query:${cacheKey}`;
  const requestKey = `request:${memoryCacheKey}`;
  const fallbackMemoryValue = getSessionCachedValue<T>(memoryCacheKey);

  if (!forceServer) {
    const memoryValue = getSessionCachedValue<T>(memoryCacheKey, maxAgeMs);

    if (memoryValue !== undefined && !isValueIncomplete(memoryValue, isIncomplete)) {
      logFirestoreRead(cacheKey, 'memory');
      return memoryValue;
    }
  }

  return runSingleFlight<T>(requestKey, async () => {
    let cachedValue: T | CacheMiss =
      fallbackMemoryValue !== undefined && !isValueIncomplete(fallbackMemoryValue, isIncomplete)
        ? fallbackMemoryValue
        : CACHE_MISS;

    if (persist) {
      try {
        const persistentValue = await getPersistentCachedValue<T>(memoryCacheKey, maxAgeMs);

        if (persistentValue !== undefined && !isValueIncomplete(persistentValue, isIncomplete)) {
          cachedValue = persistentValue;
          setSessionCachedValue(memoryCacheKey, persistentValue);

          if (!forceServer) {
            logFirestoreRead(cacheKey, 'persistent');
            return persistentValue;
          }
        }
      } catch {
        // AsyncStorage nunca debe impedir leer desde Firestore.
      }
    }

    if (!skipLocalCacheRead && (!forceServer || cachedValue === CACHE_MISS)) {
      try {
        const cacheSnapshot = await getDocsFromCache(query);
        const localValue = mapSnapshot(cacheSnapshot);
        logFirestoreRead(cacheKey, 'cache');

        if (!isValueIncomplete(localValue, isIncomplete)) {
          cachedValue = localValue;
          await setCacheLayers(memoryCacheKey, localValue, persist);

          if (!forceServer) {
            return localValue;
          }
        }
      } catch {
        // Mantener el mejor fallback disponible.
      }
    }

    try {
      const serverSnapshot = await getDocsFromServer(query);
      const mappedValue = mapSnapshot(serverSnapshot);
      await setValidCacheLayers(memoryCacheKey, mappedValue, persist, isIncomplete);
      logFirestoreRead(cacheKey, 'server');
      return mappedValue;
    } catch (error) {
      if (cachedValue !== CACHE_MISS) {
        logFirestoreRead(cacheKey, 'server-fallback');
        return cachedValue;
      }

      throw error;
    }
  });
};

export const invalidateCacheEntry = async (cacheKey: string): Promise<void> => {
  clearSessionCachedValue(`doc:${cacheKey}`);
  clearSessionCachedValue(`query:${cacheKey}`);
  await Promise.all([
    clearPersistentCachedValue(`doc:${cacheKey}`),
    clearPersistentCachedValue(`query:${cacheKey}`),
  ]);
};
