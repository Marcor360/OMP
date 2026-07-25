import { mapAuthError } from '@/src/utils/firebase-auth-errors';

describe('mapAuthError', () => {
  it.each(['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/user-disabled'])(
    'uses the same safe message for %s',
    (code) => {
      expect(mapAuthError({ code })).toEqual({
        target: 'banner',
        messageKey: 'auth.login.error.invalidCredentials',
      });
    }
  );

  it('maps invalid email to the email field', () => {
    expect(mapAuthError({ code: 'auth/invalid-email' })).toEqual({
      target: 'email',
      messageKey: 'auth.validation.emailInvalid',
    });
  });

  it.each([
    ['auth/too-many-requests', 'auth.login.error.tooManyRequests'],
    ['auth/network-request-failed', 'auth.login.error.network'],
  ])('maps %s to %s', (code, messageKey) => {
    expect(mapAuthError({ code })).toEqual({ target: 'banner', messageKey });
  });

  it('uses the default message for unknown and malformed errors', () => {
    expect(mapAuthError({ code: 'auth/internal-error' }).messageKey).toBe(
      'auth.login.error.default'
    );
    expect(mapAuthError(new Error('unexpected')).messageKey).toBe(
      'auth.login.error.default'
    );
  });
});
