type FirestoreReadSource = 'memory' | 'cache' | 'server' | 'server-fallback';

const LOG_PREFIX = '[FirestoreIO]';

const isDebugEnabled = (): boolean => {
  if (!__DEV__) return false;
  return process.env.EXPO_PUBLIC_FIRESTORE_DEBUG !== '0';
};

const formatMeta = (meta?: string): string => {
  if (!meta || meta.trim().length === 0) return '';
  return ` ${meta.trim()}`;
};

export const logFirestoreRead = (
  key: string,
  source: FirestoreReadSource,
  meta?: string
): void => {
  if (!isDebugEnabled()) return;
  console.info(`${LOG_PREFIX} read source=${source} key=${key}${formatMeta(meta)}`);
};

export const logFirestoreListenerCreated = (key: string): void => {
  if (!isDebugEnabled()) return;
  console.info(`${LOG_PREFIX} listener create key=${key}`);
};

export const logFirestoreListenerDestroyed = (key: string): void => {
  if (!isDebugEnabled()) return;
  console.info(`${LOG_PREFIX} listener destroy key=${key}`);
};

export const logFirestoreConfig = (message: string): void => {
  if (!isDebugEnabled()) return;
  console.info(`${LOG_PREFIX} config ${message}`);
};

