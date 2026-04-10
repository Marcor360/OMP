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

  const fromCode = mapFirebaseErrorCode(fb?.code);
  if (fromCode) return fromCode;

  if (fb?.message && fb.message.trim().length > 0) {
    return fb.message;
  }

  return 'Ocurrio un error inesperado. Intenta nuevamente.';
};

export const isFirebaseErrorCode = (error: unknown, expectedCode: string): boolean => {
  const code = (error as FirebaseLikeError)?.code;
  if (!code) return false;
  return normalizeCode(code) === expectedCode;
};