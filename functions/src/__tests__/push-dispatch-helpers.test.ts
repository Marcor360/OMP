import type { ExpoPushReceipt } from 'expo-server-sdk';

import {
  durableBackoffMs,
  canClaimPushDispatch,
  isPermanentExpoResult,
  isTransientTransportError,
  sanitizePushError,
} from '../modules/notifications/push-dispatch.helpers.js';

const receiptError = (error: NonNullable<Extract<ExpoPushReceipt, { status: 'error' }>['details']>['error']): ExpoPushReceipt => ({
  status: 'error', message: error ?? 'unknown', details: { error },
});

describe('push dispatch hardening helpers', () => {
  it.each(['DeviceNotRegistered', 'MessageTooBig', 'InvalidCredentials'] as const)(
    'classifies %s as permanent', (code) => expect(isPermanentExpoResult(receiptError(code))).toBe(true)
  );

  it.each(['MessageRateExceeded', 'ExpoError', 'ProviderError'] as const)(
    'classifies %s as retryable', (code) => expect(isPermanentExpoResult(receiptError(code))).toBe(false)
  );

  it('classifies 429, 5xx, timeouts and network failures as transient', () => {
    expect(isTransientTransportError({ statusCode: 429 })).toBe(true);
    expect(isTransientTransportError({ statusCode: 503 })).toBe(true);
    expect(isTransientTransportError(new Error('network timeout'))).toBe(true);
    expect(isTransientTransportError({ statusCode: 400 })).toBe(false);
  });

  it('uses bounded exponential backoff', () => {
    expect(durableBackoffMs(1)).toBe(60_000);
    expect(durableBackoffMs(2)).toBe(120_000);
    expect(durableBackoffMs(99)).toBe(21_600_000);
  });

  it('only reclaims a retry or an expired worker lease', () => {
    const now = 1_000_000;
    expect(canClaimPushDispatch('pending', null, now)).toBe(true);
    expect(canClaimPushDispatch('processing', now - 1, now)).toBe(true);
    expect(canClaimPushDispatch('processing', now + 1, now)).toBe(false);
    expect(canClaimPushDispatch('sent', null, now)).toBe(false);
    expect(canClaimPushDispatch('permanent_error', null, now)).toBe(false);
  });

  it('redacts Expo push tokens from errors', () => {
    expect(sanitizePushError(new Error('failed ExponentPushToken[secret-value]')))
      .toBe('failed [expo-token-redacted]');
  });
});
