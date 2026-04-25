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
  clearSessionCachedValue,
  getSessionCachedValue,
  runSingleFlight,
  setSessionCachedValue,
} from '@/src/services/repositories/session-cache';

const CACHE_MISS = Symbol('CACHE_MISS');

type CacheMiss = typeof CACHE_MISS;

interface CacheFirstDocumentOptions<T> {
  cacheKey: string;
  ref: DocumentReference<DocumentData>;
  mapSnapshot: (snapshot: { id: string; data: () => DocumentData | undefined }) => T;
  maxAgeMs?: number;
  forceServer?: boolean;
  isIncomplete?: (value: T) => boolean;
}

interface CacheFirstQueryOptions<T> {
  cacheKey: string;
  query: Query<DocumentData>;
  mapSnapshot: (snapshot: QuerySnapshot<DocumentData>) => T;
  maxAgeMs?: number;
  forceServer?: boolean;
  isIncomplete?: (value: T) => boolean;
}

const isValueIncomplete = <T>(
  value: T,
  isIncomplete?: (candidate: T) => boolean
): boolean => {
  if (!isIncomplete) return false;
  return isIncomplete(value);
};

export const getDocumentCacheFirst = async <T>(
  options: CacheFirstDocumentOptions<T>
): Promise<T | null> => {
  const {
    cacheKey,
    ref,
    mapSnapshot,
    maxAgeMs,
    forceServer = false,
    isIncomplete,
  } = options;
  const memoryCacheKey = `doc:${cacheKey}`;
  const requestKey = `request:${memoryCacheKey}`;
  const fallbackMemoryValue = getSessionCachedValue<T | null>(memoryCacheKey);

  if (!forceServer) {
    const memoryValue = getSessionCachedValue<T | null>(memoryCacheKey, maxAgeMs);

    if (
      memoryValue !== undefined &&
      !(memoryValue !== null && isValueIncomplete(memoryValue, isIncomplete))
    ) {
      logFirestoreRead(cacheKey, 'memory');
      return memoryValue;
    }
  }

  return runSingleFlight<T | null>(requestKey, async () => {
    let cachedValue: T | null | CacheMiss =
      fallbackMemoryValue !== undefined ? fallbackMemoryValue : CACHE_MISS;

    // Siempre intentamos cache local como posible respaldo.
    // Si forceServer=true, NO retornamos desde cache; solo lo guardamos para fallback.
    if (!forceServer || cachedValue === CACHE_MISS) {
      try {
        const cacheSnapshot = await getDocFromCache(ref);

        if (!cacheSnapshot.exists()) {
          cachedValue = null;
        } else {
          cachedValue = mapSnapshot(cacheSnapshot);
        }

        setSessionCachedValue(memoryCacheKey, cachedValue);
        logFirestoreRead(cacheKey, 'cache');

        if (
          !forceServer &&
          !(cachedValue !== null && isValueIncomplete(cachedValue, isIncomplete))
        ) {
          return cachedValue;
        }
      } catch {
        // Mantener fallback previo (memoria) si existía.
      }
    }

    try {
      const serverSnapshot = await getDocFromServer(ref);

      if (!serverSnapshot.exists()) {
        setSessionCachedValue(memoryCacheKey, null);
        logFirestoreRead(cacheKey, 'server', 'exists=false');
        return null;
      }

      const mappedValue = mapSnapshot(serverSnapshot);
      setSessionCachedValue(memoryCacheKey, mappedValue);
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
    forceServer = false,
    isIncomplete,
  } = options;
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
      fallbackMemoryValue !== undefined ? fallbackMemoryValue : CACHE_MISS;

    // Siempre intentamos cache local como posible respaldo.
    // Si forceServer=true, NO retornamos desde cache; solo lo guardamos para fallback.
    if (!forceServer || cachedValue === CACHE_MISS) {
      try {
        const cacheSnapshot = await getDocsFromCache(query);
        cachedValue = mapSnapshot(cacheSnapshot);
        setSessionCachedValue(memoryCacheKey, cachedValue);
        logFirestoreRead(cacheKey, 'cache');

        if (!forceServer && !isValueIncomplete(cachedValue, isIncomplete)) {
          return cachedValue;
        }
      } catch {
        // Mantener fallback previo (memoria) si existía.
      }
    }

    try {
      const serverSnapshot = await getDocsFromServer(query);
      const mappedValue = mapSnapshot(serverSnapshot);
      setSessionCachedValue(memoryCacheKey, mappedValue);
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

export const invalidateCacheEntry = (cacheKey: string): void => {
  clearSessionCachedValue(`doc:${cacheKey}`);
  clearSessionCachedValue(`query:${cacheKey}`);
};
