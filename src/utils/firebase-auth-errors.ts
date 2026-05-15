type AuthErrorLanguage = 'es' | 'en';

const AUTH_ERROR_MESSAGES: Record<AuthErrorLanguage, Record<string, string>> = {
  es: {
    // Errores de email
    'auth/invalid-email': 'El correo electrónico no es válido.',
    'auth/email-already-in-use': 'Este correo ya está registrado.',
    'auth/user-not-found': 'No existe una cuenta con este correo.',

    // Errores de contraseña
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/weak-password': 'La contraseña es demasiado débil.',

    // Errores de cuenta
    'auth/user-disabled': 'Esta cuenta ha sido deshabilitada.',
    'auth/account-exists-with-different-credential':
      'Ya existe una cuenta con este email usando otro método de acceso.',

    // Errores de red/operación
    'auth/network-request-failed': 'Error de conexión. Verifica tu internet.',
    'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde.',
    'auth/operation-not-allowed': 'Este método de autenticación no está habilitado.',

    // Errores de sesión
    'auth/requires-recent-login': 'Esta operación requiere que vuelvas a iniciar sesión.',
    'auth/credential-already-in-use': 'Esta credencial ya está en uso por otra cuenta.',

    // Errores generales
    'auth/invalid-credential': 'Credenciales inválidas. Verifica tu email y contraseña.',
    'auth/invalid-verification-code': 'Código de verificación inválido.',
    'auth/invalid-verification-id': 'ID de verificación inválido.',
  },
  en: {
    'auth/invalid-email': 'The email address is not valid.',
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/user-not-found': 'No account exists with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/weak-password': 'The password is too weak.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/account-exists-with-different-credential':
      'An account already exists with this email using another sign-in method.',
    'auth/network-request-failed': 'Connection error. Check your internet connection.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/operation-not-allowed': 'This authentication method is not enabled.',
    'auth/requires-recent-login': 'This operation requires you to sign in again.',
    'auth/credential-already-in-use': 'This credential is already used by another account.',
    'auth/invalid-credential': 'Invalid credentials. Check your email and password.',
    'auth/invalid-verification-code': 'Invalid verification code.',
    'auth/invalid-verification-id': 'Invalid verification ID.',
  },
};

/**
 * Traduce códigos de error de Firebase Auth al idioma activo.
 */
export function getAuthErrorMessage(
  errorCode: string,
  language: AuthErrorLanguage = 'es'
): string {
  const messages = AUTH_ERROR_MESSAGES[language] ?? AUTH_ERROR_MESSAGES.es;
  return messages[errorCode] || (
    language === 'en' ? 'An error occurred. Try again.' : 'Ocurrió un error. Intenta nuevamente.'
  );
}

/**
 * Extrae el código de error de Firebase y devuelve el mensaje traducido
 */
export function handleAuthError(error: unknown, language: AuthErrorLanguage = 'es'): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return getAuthErrorMessage((error as { code: string }).code, language);
  }
  return language === 'en'
    ? 'An unexpected error occurred. Try again.'
    : 'Ocurrió un error inesperado. Intenta nuevamente.';
}
