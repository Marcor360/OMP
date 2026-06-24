export interface CacheControlRepository {
  getControlFromServer(): Promise<Record<string, unknown> | null>;
  purgeWebPersistence(): Promise<void>;
}
