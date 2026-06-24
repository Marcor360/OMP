import {
  clearIndexedDbPersistence,
  getDocFromServer,
  terminate,
} from 'firebase/firestore';
import { Platform } from 'react-native';

import { db } from '@/src/config/firebase/firebase';
import { systemDocRef } from '@/src/lib/firebase/refs';
import type { CacheControlRepository } from '@/src/services/repositories/ports/cache-control-repository.port';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { createLogger } from '@/src/utils/logger';

const log = createLogger('cache-control');

// Activar solo si quieres limpiar la persistencia de Firestore en web
// al inicio de la app (cold start) y antes de listeners activos.
const ENABLE_FIRESTORE_WEB_PERSISTENCE_PURGE = false;

export const firestoreCacheControlRepository: CacheControlRepository = {
  getControlFromServer: async (): Promise<Record<string, unknown> | null> => {
    const snapshot = await getDocFromServer(systemDocRef('cacheControl'));
    if (!snapshot.exists()) return null;
    return snapshot.data() as Record<string, unknown>;
  },

  purgeWebPersistence: async (): Promise<void> => {
    if (Platform.OS !== 'web' || !ENABLE_FIRESTORE_WEB_PERSISTENCE_PURGE) {
      return;
    }

    try {
      await terminate(db);
      await clearIndexedDbPersistence(db);
    } catch (error) {
      log.warn(
        '[CacheControl] Firestore persistence cleanup:',
        formatFirestoreError(error)
      );
    }
  },
};
