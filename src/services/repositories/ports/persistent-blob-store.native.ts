import * as FileSystem from 'expo-file-system/legacy';

import type { PersistentBlobStore } from './persistent-blob-store';

type ManifestEntry = {
  file: string;
  updatedAt: number;
};

type Manifest = Record<string, ManifestEntry>;

const CACHE_DIR = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}omp-persistent-cache/`
  : null;
const MANIFEST_FILE = 'manifest.json';
const MANIFEST_PATH = CACHE_DIR ? `${CACHE_DIR}${MANIFEST_FILE}` : null;
const MAX_ENTRY_BYTES = 2 * 1024 * 1024;
const MAX_ENTRIES = 500;
const MANIFEST_DEBOUNCE_MS = 250;

let initializationPromise: Promise<void> | null = null;
let manifest: Manifest | null = null;
let manifestWriteTimer: ReturnType<typeof setTimeout> | null = null;

const estimateBytes = (value: string): number => {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  return value.length;
};

const fnv1a = (key: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const isManifest = (value: unknown): value is Manifest =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const removeOrphanedFiles = async (): Promise<void> => {
  if (!CACHE_DIR) return;
  try {
    const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
    await Promise.allSettled(
      files
        .filter((file) => file !== MANIFEST_FILE)
        .map((file) =>
          FileSystem.deleteAsync(`${CACHE_DIR}${file}`, { idempotent: true })
        )
    );
  } catch {
    // Cache failures always degrade to a miss.
  }
};

const initialize = async (): Promise<void> => {
  if (manifest) return;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    if (!CACHE_DIR || !MANIFEST_PATH) {
      manifest = {};
      return;
    }

    try {
      const directoryInfo = await FileSystem.getInfoAsync(CACHE_DIR);
      if (!directoryInfo.exists) {
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      }

      const manifestInfo = await FileSystem.getInfoAsync(MANIFEST_PATH);
      if (!manifestInfo.exists) {
        manifest = {};
        return;
      }

      const raw = await FileSystem.readAsStringAsync(MANIFEST_PATH);
      const parsed: unknown = JSON.parse(raw);
      if (!isManifest(parsed)) throw new Error('Invalid cache manifest');
      manifest = parsed;
    } catch {
      manifest = {};
      await removeOrphanedFiles();
    }
  })().finally(() => {
    initializationPromise = null;
  });

  return initializationPromise;
};

const flushManifest = async (): Promise<void> => {
  if (!MANIFEST_PATH || !manifest) return;
  if (manifestWriteTimer) {
    clearTimeout(manifestWriteTimer);
    manifestWriteTimer = null;
  }
  try {
    await FileSystem.writeAsStringAsync(MANIFEST_PATH, JSON.stringify(manifest));
  } catch {
    // Cache failures never escape to callers.
  }
};

const scheduleManifestWrite = (): void => {
  if (manifestWriteTimer) clearTimeout(manifestWriteTimer);
  manifestWriteTimer = setTimeout(() => {
    manifestWriteTimer = null;
    void flushManifest();
  }, MANIFEST_DEBOUNCE_MS);
};

const store: PersistentBlobStore = {
  maxEntryBytes: MAX_ENTRY_BYTES,
  maxEntries: MAX_ENTRIES,

  getItem: async (key) => {
    try {
      await initialize();
      const entry = manifest?.[key];
      if (!entry || !CACHE_DIR) return null;
      return await FileSystem.readAsStringAsync(`${CACHE_DIR}${entry.file}`);
    } catch {
      return null;
    }
  },

  setItem: async (key, value) => {
    if (estimateBytes(value) > MAX_ENTRY_BYTES) return;
    try {
      await initialize();
      if (!manifest || !CACHE_DIR) return;
      const file = `${fnv1a(key)}.json`;
      await FileSystem.writeAsStringAsync(`${CACHE_DIR}${file}`, value);
      manifest[key] = { file, updatedAt: Date.now() };
      scheduleManifestWrite();
    } catch {
      // noop
    }
  },

  removeItems: async (keys) => {
    try {
      await initialize();
      if (!manifest || !CACHE_DIR) return;
      const files = new Set(
        keys.map((key) => manifest?.[key]?.file).filter((file): file is string => Boolean(file))
      );
      keys.forEach((key) => delete manifest?.[key]);
      await Promise.allSettled(
        Array.from(files).map((file) =>
          FileSystem.deleteAsync(`${CACHE_DIR}${file}`, { idempotent: true })
        )
      );
      await flushManifest();
    } catch {
      // noop
    }
  },

  getAllKeys: async () => {
    try {
      await initialize();
      return Object.keys(manifest ?? {});
    } catch {
      return [];
    }
  },

  multiGet: async (keys) =>
    Promise.all(keys.map(async (key) => [key, await store.getItem(key)] as [string, string | null])),
};

export const getPersistentBlobStore = (): PersistentBlobStore => store;
