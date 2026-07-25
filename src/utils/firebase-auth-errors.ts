export type LoginAuthErrorTarget = 'email' | 'banner';

export interface LoginAuthErrorMapping {
  target: LoginAuthErrorTarget;
  messageKey:
    | 'auth.validation.emailInvalid'
    | 'auth.login.error.invalidCredentials'
    | 'auth.login.error.tooManyRequests'
    | 'auth.login.error.network'
    | 'auth.login.error.default';
}

const INVALID_CREDENTIAL_CODES = new Set([
  'auth/invalid-credential',
  'auth/wrong-password',
  'auth/user-not-found',
  'auth/user-disabled',
]);

function getAuthErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return null;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

/**
 * Maps Firebase Auth login failures to safe, localized UI message keys.
 * Credential failures deliberately share one message to avoid account enumeration.
 */
export function mapAuthError(error: unknown): LoginAuthErrorMapping {
  const code = getAuthErrorCode(error);

  if (code === 'auth/invalid-email') {
    return { target: 'email', messageKey: 'auth.validation.emailInvalid' };
  }

  if (code && INVALID_CREDENTIAL_CODES.has(code)) {
    return { target: 'banner', messageKey: 'auth.login.error.invalidCredentials' };
  }

  if (code === 'auth/too-many-requests') {
    return { target: 'banner', messageKey: 'auth.login.error.tooManyRequests' };
  }

  if (code === 'auth/network-request-failed') {
    return { target: 'banner', messageKey: 'auth.login.error.network' };
  }

  return { target: 'banner', messageKey: 'auth.login.error.default' };
}
