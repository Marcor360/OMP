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
  inFlightCache.delete(key);
};

export const clearSessionCacheByPrefix = (prefix: string): void => {
  if (!prefix) return;

  valueCache.forEach((_, key) => {
    if (key.startsWith(prefix)) {
      valueCache.delete(key);
    }
  });

  inFlightCache.forEach((_, key) => {
    if (key.startsWith(prefix)) {
      inFlightCache.delete(key);
    }
  });
};

export const clearAllSessionCache = (): void => {
  valueCache.clear();
  inFlightCache.clear();
};

export const runSingleFlight = <T>(
  key: string,
  factory: () => Promise<T>
): Promise<T> => {
  const existing = inFlightCache.get(key);
  if (existing) return existing as Promise<T>;

  const request = factory().finally(() => {
    inFlightCache.delete(key);
  });

  inFlightCache.set(key, request as Promise<unknown>);
  return request;
};

