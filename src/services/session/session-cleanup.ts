import AsyncStorage from '@react-native-async-storage/async-storage';

import { markFirestoreCacheSessionBoundary } from '@/src/services/repositories/firestore-cache-first';
import { clearAllPersistentCache } from '@/src/services/repositories/persistent-cache';
import { clearAllSessionCache } from '@/src/services/repositories/session-cache';
import { createLogger } from '@/src/utils/logger';

const log = createLogger('session-cleanup');

// Solo claves globales legadas. Las caches nuevas con namespace de uid y
// congregationId se conservan para rehidratar al mismo usuario en su proximo login.
const LEGACY_SESSION_ASYNC_STORAGE_KEYS = [
  '@cleaning_groups',
  '@cleaning_assignable_users',
  // Clave legada (pre-namespacing por uid) del contador local de horas de
  // predicación. Ya no se escribe (ver field-service-storage.ts), pero se
  // purga una vez por logout para no dejar datos huérfanos de un usuario
  // anterior visibles en dispositivos compartidos. Las claves nuevas
  // (@field_service_v1:<uid>) NO están en esta lista a propósito: son
  // caché en disco por usuario y deben sobrevivir al logout.
  '@field_service_v1',
] as const;

const warnSessionCleanupError = (operation: string, error: unknown): void => {
  if (__DEV__) {
    log.warn(`[session-cleanup] ${operation}`, error);
  }
};

const clearKnownSessionAsyncStorageCache = async (): Promise<void> => {
  await AsyncStorage.multiRemove([...LEGACY_SESSION_ASYNC_STORAGE_KEYS]);
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
