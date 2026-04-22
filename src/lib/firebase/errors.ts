const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  'permission-denied': 'No tienes permisos para realizar esta operacion.',
  'unavailable': 'El servicio no esta disponible temporalmente.',
  'not-found': 'El recurso no existe.',
  'already-exists': 'El recurso ya existe.',
  'failed-precondition': 'No se puede completar la operacion en el estado actual.',
  'deadline-exceeded': 'La operacion tardo demasiado. Intenta nuevamente.',
  'unauthenticated': 'Tu sesion expiro. Inicia sesion nuevamente.',
  'invalid-argument': 'Los datos enviados no son validos.',
  'internal': 'Ocurrio un error interno del servicio.',
  'cancelled': 'La operacion fue cancelada.',
};

type FirebaseLikeError = {
  code?: string;
  message?: string;
};

const normalizeErrorMessage = (message?: string): string | undefined => {
  if (!message || typeof message !== 'string') return undefined;

  const trimmed = message.trim();
  if (!trimmed) return undefined;

  // firebase-js usually wraps callable errors as:
  // "Firebase: <message> (functions/code)."
  const withoutPrefix = trimmed.replace(/^Firebase:\s*/i, '');
  const withoutCodeSuffix = withoutPrefix.replace(/\s*\((?:auth|firestore|functions)\/[a-z-]+\)\.?$/i, '');
  const normalized = withoutCodeSuffix.trim();

  return normalized.length > 0 ? normalized : undefined;
};

const isGenericSdkMessage = (message: string): boolean => {
  const normalized = message.toLowerCase();

  return (
    normalized.includes('missing or insufficient permissions') ||
    normalized.includes('permission denied') ||
    normalized.includes('insufficient permissions')
  );
};

const normalizeCode = (code: string): string => {
  if (code.includes('/')) {
    return code.split('/').pop() ?? code;
  }

  return code;
};

export const mapFirebaseErrorCode = (code?: string): string | undefined => {
  if (!code) return undefined;
  return FIREBASE_ERROR_MESSAGES[normalizeCode(code)];
};

export const getFirebaseErrorMessage = (error: unknown): string => {
  const fb = error as FirebaseLikeError;
  const normalizedCode = fb?.code ? normalizeCode(fb.code) : undefined;
  const normalizedMessage = normalizeErrorMessage(fb?.message);

  if (normalizedMessage && !isGenericSdkMessage(normalizedMessage)) {
    return normalizedMessage;
  }

  const fromCode = mapFirebaseErrorCode(normalizedCode);
  if (fromCode) return fromCode;

  if (normalizedMessage) return normalizedMessage;

  return 'Ocurrio un error inesperado. Intenta nuevamente.';
};

export const isFirebaseErrorCode = (error: unknown, expectedCode: string): boolean => {
  const code = (error as FirebaseLikeError)?.code;
  if (!code) return false;
  return normalizeCode(code) === expectedCode;
};
