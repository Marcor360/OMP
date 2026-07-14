import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PersistentBlobStore } from './persistent-blob-store';

const STORAGE_PREFIX = 'omp:persistent-cache:';
const MAX_ENTRY_BYTES = 250 * 1024;
const MAX_ENTRIES = 300;

const toStorageKey = (key: string): string => `${STORAGE_PREFIX}${key}`;

const estimateBytes = (value: string): number => {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  return value.length;
};

const store: PersistentBlobStore = {
  maxEntryBytes: MAX_ENTRY_BYTES,
  maxEntries: MAX_ENTRIES,

  getItem: (key) => AsyncStorage.getItem(toStorageKey(key)),

  setItem: async (key, value) => {
    if (estimateBytes(value) > MAX_ENTRY_BYTES) return;
    await AsyncStorage.setItem(toStorageKey(key), value);
  },

  removeItems: async (keys) => {
    if (keys.length > 0) {
      await AsyncStorage.multiRemove(keys.map(toStorageKey));
    }
  },

  getAllKeys: async () => {
    const keys = await AsyncStorage.getAllKeys();
    return keys
      .filter((key) => key.startsWith(STORAGE_PREFIX))
      .map((key) => key.slice(STORAGE_PREFIX.length));
  },

  multiGet: async (keys) => {
    const pairs = await AsyncStorage.multiGet(keys.map(toStorageKey));
    return pairs.map(([, raw], index) => [keys[index], raw]);
  },
};

export const getPersistentBlobStore = (): PersistentBlobStore => store;
