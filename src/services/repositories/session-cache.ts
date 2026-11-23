import {
  clearPersistentCachedValue,
  clearPersistentCacheByPrefix,
} from '@/src/services/repositories/persistent-cache';

type SessionCacheEntry<T> = {
  value: T;
  updatedAt: number;
};

const valueCache = new Map<string, SessionCacheEntry<unknown>>();
const inFlightCache = new Map<string, Promise<unknown>>();

export const getSessionCachedValue = <T>(
  key: string,
  maxAgeMs?: number
): T | undefined => {
  const entry = valueCache.get(key);

  if (!entry) return undefined;

  if (
    typeof maxAgeMs === 'number' &&
    Number.isFinite(maxAgeMs) &&
    maxAgeMs > 0 &&
    Date.now() - entry.updatedAt > maxAgeMs
  ) {
    valueCache.delete(key);
    return undefined;
  }

  return entry.value as T;
};

export const setSessionCachedValue = <T>(key: string, value: T): void => {
  valueCache.set(key, {
    value,
    updatedAt: Date.now(),
  });
};

export const clearSessionCachedValue = (key: string): void => {
  valueCache.delete(key);
  inFlightCache.delete(`request:${key}`);
  void clearPersistentCachedValue(key);
};

export const clearSessionCacheByPrefix = (prefix: string): void => {
  if (!prefix) return;

  valueCache.forEach((_, key) => {
    if (key.startsWith(prefix)) {
      valueCache.delete(key);
    }
  });

  inFlightCache.forEach((_, key) => {
    if (key.startsWith(`request:${prefix}`)) {
      inFlightCache.delete(key);
    }
  });

  void clearPersistentCacheByPrefix(prefix);
};

// No limpia cache persistente por diseno. Para logout o cambio de sesion
// usar clearLocalSessionData(), que limpia memoria, persistencia y caches temporales.
export const clearAllSessionCache = (): void => {
  valueCache.clear();
  inFlightCache.clear();
};

export const runSingleFlight = <T>(
  key: string,
  factory: (isCurrent: () => boolean) => Promise<T>
): Promise<T> => {
  const existing = inFlightCache.get(key);
  if (existing) return existing as Promise<T>;

  let request: Promise<T> | undefined;
  const isCurrent = () => request !== undefined && inFlightCache.get(key) === request;

  request = factory(isCurrent).finally(() => {
    if (isCurrent()) {
      inFlightCache.delete(key);
    }
  });

  inFlightCache.set(key, request);
  return request;
};

