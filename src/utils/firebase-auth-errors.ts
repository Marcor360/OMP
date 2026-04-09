/**
 * Traduce códigos de error de Firebase Auth a mensajes en español
 */
export function getAuthErrorMessage(errorCode: string): string {
  const errorMessages: Record<string, string> = {
    // Errores de email
    'auth/invalid-email': 'El correo electrónico no es válido.',
    'auth/email-already-in-use': 'Este correo ya está registrado.',
    'auth/user-not-found': 'No existe una cuenta con este correo.',

    // Errores de contraseña
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/weak-password': 'La contraseña es demasiado débil.',

    // Errores de cuenta
    'auth/user-disabled': 'Esta cuenta ha sido deshabilitada.',
    'auth/account-exists-with-different-credential': 'Ya existe una cuenta con este email usando otro método de acceso.',

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
  };

  return errorMessages[errorCode] || 'Ocurrió un error. Intenta nuevamente.';
}

/**
 * Extrae el código de error de Firebase y devuelve el mensaje traducido
 */
export function handleAuthError(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return getAuthErrorMessage((error as { code: string }).code);
  }
  return 'Ocurrió un error inesperado. Intenta nuevamente.';
}
