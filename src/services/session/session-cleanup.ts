import AsyncStorage from '@react-native-async-storage/async-storage';

import { markFirestoreCacheSessionBoundary } from '@/src/services/repositories/firestore-cache-first';
import { clearAllPersistentCache } from '@/src/services/repositories/persistent-cache';
import { clearAllSessionCache } from '@/src/services/repositories/session-cache';

const SESSION_ASYNC_STORAGE_KEYS = [
  '@cleaning_groups',
  '@cleaning_assignable_users',
] as const;

const SESSION_ASYNC_STORAGE_PREFIXES = [
  '@omp/my-cleaning-dashboard',
] as const;

const PRESERVED_ASYNC_STORAGE_KEYS = new Set([
  '@field_service_v1',
  '@omp/language',
  '@omp/language-onboarding-complete',
  '@omp/theme-mode',
]);

const warnSessionCleanupError = (operation: string, error: unknown): void => {
  if (__DEV__) {
    console.warn(`[session-cleanup] ${operation}`, error);
  }
};

const clearKnownSessionAsyncStorageCache = async (): Promise<void> => {
  const keys = await AsyncStorage.getAllKeys();
  const prefixMatches = keys.filter((key) =>
    SESSION_ASYNC_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))
  );

  const keysToRemove = Array.from(
    new Set<string>([...SESSION_ASYNC_STORAGE_KEYS, ...prefixMatches])
  ).filter((key) => !PRESERVED_ASYNC_STORAGE_KEYS.has(key));

  if (keysToRemove.length > 0) {
    await AsyncStorage.multiRemove(keysToRemove);
  }
};

export const clearTemporaryCacheData = async (): Promise<void> => {
  markFirestoreCacheSessionBoundary();
  clearAllSessionCache();
  await clearAllPersistentCache();

  try {
    await clearKnownSessionAsyncStorageCache();
  } catch (error) {
    warnSessionCleanupError('clear local async storage', error);
  }
};

export const clearLocalSessionData = async (): Promise<void> => {
  await clearTemporaryCacheData();
};
