export interface PersistentBlobStore {
  /** Lee el string crudo de una clave lógica; null si no existe. */
  getItem(key: string): Promise<string | null>;
  /** Escribe; rechaza silenciosamente si excede maxEntryBytes. */
  setItem(key: string, value: string): Promise<void>;
  removeItems(keys: string[]): Promise<void>;
  /** Todas las claves lógicas conocidas (sin prefijo de storage). */
  getAllKeys(): Promise<string[]>;
  /** Pares [key, raw] para poda LRU. */
  multiGet(keys: string[]): Promise<[string, string | null][]>;
  readonly maxEntryBytes: number;
  readonly maxEntries: number;
}

export declare const getPersistentBlobStore: () => PersistentBlobStore;
