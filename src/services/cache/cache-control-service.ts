import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  clearIndexedDbPersistence,
  doc,
  getDocFromServer,
  terminate,
} from 'firebase/firestore';

import { db } from '@/src/config/firebase/firebase';
import { clearAllSessionCache } from '@/src/services/repositories/session-cache';
import { formatFirestoreError } from '@/src/utils/errors/errors';

const CACHE_CONTROL_DOC = doc(db, 'system', 'cacheControl');
const CACHE_CONTROL_ACK_KEY = '@system_cache_control_ack_v1';
const TEMP_ASYNC_STORAGE_KEYS = ['@cleaning_groups', '@cleaning_assignable_users'] as const;

// Solo se eliminan llaves temporales conocidas.
const WEB_LOCAL_STORAGE_TEMP_PREFIXES = ['@temp_', '@cache_', '@offline_', '@query_'] as const;
const WEB_CACHE_API_TEMP_PREFIXES = ['temp-', 'runtime-', 'offline-temp-'] as const;
const WEB_INDEXED_DB_TEMP_PREFIXES = ['omp-temp-'] as const;

// Activar solo si quieres limpiar la persistencia de Firestore en web
// al inicio de la app (cold start) y antes de listeners activos.
const ENABLE_FIRESTORE_WEB_PERSISTENCE_PURGE = false;

type RemoteCacheControl = {
  cacheVersion: number;
  lastCleanupRequestAtMillis: number | null;
};

type LocalCacheControlAck = {
  cacheVersion: number;
  lastCleanupRequestAtMillis: number | null;
  acknowledgedAt: string;
};

const toMillis = (value: unknown): number | null => {
  if (!value || typeof value !== 'object') return null;
  if (!('toMillis' in value)) return null;

  const candidate = value as { toMillis?: unknown };
  if (typeof candidate.toMillis !== 'function') return null;

  try {
    const millis = candidate.toMillis();
    return typeof millis === 'number' && Number.isFinite(millis) ? millis : null;
  } catch {
    return null;
  }
};

const readRemoteCacheControl = async (): Promise<RemoteCacheControl | null> => {
  const snapshot = await getDocFromServer(CACHE_CONTROL_DOC);
  if (!snapshot.exists()) return null;

  const data = snapshot.data() as Record<string, unknown>;
  const cacheVersion = typeof data.cacheVersion === 'number' ? data.cacheVersion : 0;
  const lastCleanupRequestAtMillis = toMillis(data.lastCleanupRequestAt);

  return {
    cacheVersion,
    lastCleanupRequestAtMillis,
  };
};

const readLocalAck = async (): Promise<LocalCacheControlAck | null> => {
  const raw = await AsyncStorage.getItem(CACHE_CONTROL_ACK_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<LocalCacheControlAck>;
    return {
      cacheVersion:
        typeof parsed.cacheVersion === 'number' ? parsed.cacheVersion : 0,
      lastCleanupRequestAtMillis:
        typeof parsed.lastCleanupRequestAtMillis === 'number' ?
          parsed.lastCleanupRequestAtMillis :
          null,
      acknowledgedAt:
        typeof parsed.acknowledgedAt === 'string' ?
          parsed.acknowledgedAt :
          new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
};

const saveLocalAck = async (remote: RemoteCacheControl): Promise<void> => {
  const payload: LocalCacheControlAck = {
    cacheVersion: remote.cacheVersion,
    lastCleanupRequestAtMillis: remote.lastCleanupRequestAtMillis,
    acknowledgedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(CACHE_CONTROL_ACK_KEY, JSON.stringify(payload));
};

const shouldRunCleanup = (
  remote: RemoteCacheControl,
  local: LocalCacheControlAck | null
): boolean => {
  if (!local) return true;

  if (remote.cacheVersion > local.cacheVersion) {
    return true;
  }

  if (
    remote.lastCleanupRequestAtMillis !== null &&
    (local.lastCleanupRequestAtMillis === null ||
      remote.lastCleanupRequestAtMillis > local.lastCleanupRequestAtMillis)
  ) {
    return true;
  }

  return false;
};

const clearWebTemporaryStorage = async (): Promise<void> => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  try {
    const localKeys = Object.keys(window.localStorage);
    for (const key of localKeys) {
      const shouldDelete = WEB_LOCAL_STORAGE_TEMP_PREFIXES.some((prefix) =>
        key.startsWith(prefix)
      );
      if (shouldDelete) {
        window.localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.warn('[CacheControl] localStorage cleanup:', formatFirestoreError(error));
  }

  try {
    if ('caches' in window) {
      const cacheNames = await window.caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) =>
            WEB_CACHE_API_TEMP_PREFIXES.some((prefix) =>
              name.startsWith(prefix)
            )
          )
          .map((name) => window.caches.delete(name))
      );
    }
  } catch (error) {
    console.warn('[CacheControl] Cache API cleanup:', formatFirestoreError(error));
  }

  try {
    const indexedDbFactory = (globalThis as { indexedDB?: unknown })
      .indexedDB as
      | {
          databases?: () => Promise<{ name?: string }[]>;
          deleteDatabase: (name: string) => unknown;
        }
      | undefined;

    if (!indexedDbFactory || typeof indexedDbFactory.databases !== 'function') {
      return;
    }

    const databases = await indexedDbFactory.databases();
    for (const dbInfo of databases) {
      const name = dbInfo.name;
      if (!name) continue;

      const shouldDelete = WEB_INDEXED_DB_TEMP_PREFIXES.some((prefix) =>
        name.startsWith(prefix)
      );

      if (shouldDelete) {
        indexedDbFactory.deleteDatabase(name);
      }
    }
  } catch (error) {
    console.warn('[CacheControl] IndexedDB cleanup:', formatFirestoreError(error));
  }
};

const clearFirestorePersistenceOnWeb = async (): Promise<void> => {
  if (Platform.OS !== 'web' || !ENABLE_FIRESTORE_WEB_PERSISTENCE_PURGE) {
    return;
  }

  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch (error) {
    console.warn(
      '[CacheControl] Firestore persistence cleanup:',
      formatFirestoreError(error)
    );
  }
};

const clearNativeTemporaryFiles = async (): Promise<void> => {
  if (Platform.OS === 'web') return;

  try {
    const fileSystem = await import('expo-file-system/legacy');
    const cacheDirectory = fileSystem.cacheDirectory;
    if (!cacheDirectory) return;

    const entries = await fileSystem.readDirectoryAsync(cacheDirectory);
    const deletions = entries
      .filter((name) =>
        name.startsWith('temp-') ||
        name.startsWith('cache-') ||
        name.endsWith('.tmp')
      )
      .map((name) =>
        fileSystem.deleteAsync(`${cacheDirectory}${name}`, { idempotent: true })
      );

    await Promise.allSettled(deletions);
  } catch (error) {
    console.warn('[CacheControl] Native file cleanup:', formatFirestoreError(error));
  }
};

const clearTemporaryApplicationCache = async (): Promise<void> => {
  clearAllSessionCache();
  await AsyncStorage.multiRemove([...TEMP_ASYNC_STORAGE_KEYS]);
  await clearWebTemporaryStorage();
  await clearFirestorePersistenceOnWeb();
  await clearNativeTemporaryFiles();
};

export const syncCacheCleanupControl = async (): Promise<{
  executed: boolean;
  reason: string;
}> => {
  try {
    const remote = await readRemoteCacheControl();
    if (!remote) {
      return { executed: false, reason: 'cache-control-not-found' };
    }

    const local = await readLocalAck();
    if (!shouldRunCleanup(remote, local)) {
      return { executed: false, reason: 'already-acknowledged' };
    }

    await clearTemporaryApplicationCache();
    await saveLocalAck(remote);

    return { executed: true, reason: 'cleanup-applied' };
  } catch (error) {
    console.warn('[CacheControl] Sync error:', formatFirestoreError(error));
    return { executed: false, reason: 'sync-error' };
  }
};
