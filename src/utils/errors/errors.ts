/** Mapeo de códigos de error de Firestore a mensajes amigables */
const FIRESTORE_ERROR_MESSAGES: Record<string, string> = {
  'permission-denied': 'No tienes permisos para realizar esta operación.',
  'not-found': 'El recurso solicitado no fue encontrado.',
  'already-exists': 'Este registro ya existe.',
  'resource-exhausted': 'Límite de solicitudes alcanzado. Intenta más tarde.',
  'failed-precondition': 'Operación no válida en el estado actual.',
  'unavailable': 'Servicio no disponible. Verifica tu conexión.',
  'deadline-exceeded': 'La operación tardó demasiado. Intenta nuevamente.',
  'unauthenticated': 'Tu sesión ha expirado. Inicia sesión nuevamente.',
  'cancelled': 'Operación cancelada.',
  'internal': 'Error interno del servidor.',
  'invalid-argument': 'Datos inválidos. Verifica los campos e intenta nuevamente.',
};

interface FirebaseError {
  code?: string;
  message?: string;
}

/** Convierte un error de Firebase/Firestore en un mensaje amigable */
export const formatFirestoreError = (error: unknown): string => {
  const fb = error as FirebaseError;

  if (fb?.code) {
    // Extraer la parte del código después de "firestore/"
    const code = fb.code.replace('firestore/', '');
    if (FIRESTORE_ERROR_MESSAGES[code]) {
      return FIRESTORE_ERROR_MESSAGES[code];
    }
  }

  if (fb?.message) {
    return fb.message;
  }

  return 'Ocurrió un error inesperado. Intenta nuevamente.';
};

/** Error genérico para mostrar al usuario */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly original?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Lanza si condicioón es falsa */
export const invariant = (condition: boolean, message: string): void => {
  if (!condition) throw new AppError(message);
};
