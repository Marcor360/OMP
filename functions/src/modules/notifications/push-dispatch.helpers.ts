import type { ExpoPushReceipt, ExpoPushTicket } from 'expo-server-sdk';

export const MAX_DURABLE_PUSH_ATTEMPTS = 8;
export const PUSH_DISPATCH_LEASE_MS = 2 * 60 * 1000;

const TRANSIENT_EXPO_CODES = new Set(['MessageRateExceeded', 'ExpoError', 'ProviderError']);

export const expoErrorCode = (
  result: ExpoPushTicket | ExpoPushReceipt
): string | null => result.status === 'error' ? result.details?.error ?? 'unknown' : null;

export const isPermanentExpoResult = (
  result: ExpoPushTicket | ExpoPushReceipt
): boolean => {
  const code = expoErrorCode(result);
  return code !== null && !TRANSIENT_EXPO_CODES.has(code);
};

export const isTransientTransportError = (error: unknown): boolean => {
  const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
    ? (error as { statusCode?: unknown }).statusCode
    : null;
  const message = error instanceof Error ? error.message : String(error);
  return statusCode === 429 ||
    (typeof statusCode === 'number' && statusCode >= 500) ||
    /timeout|network|temporar|econnreset|socket hang up/i.test(message);
};

export const durableBackoffMs = (attempt: number): number =>
  Math.min(6 * 60 * 60 * 1000, 60 * 1000 * 2 ** Math.max(0, attempt - 1));

/** Only pending work or an expired lease may be claimed by a worker. */
export const canClaimPushDispatch = (
  status: unknown,
  leaseUntilMillis: number | null,
  nowMillis: number
): boolean => status === 'pending' || (
  status === 'processing' && (leaseUntilMillis === null || leaseUntilMillis <= nowMillis)
);

export const sanitizePushError = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/ExponentPushToken\[[^\]]+\]/g, '[expo-token-redacted]')
    .replace(/ExpoPushToken\[[^\]]+\]/g, '[expo-token-redacted]')
    .slice(0, 300);
};
