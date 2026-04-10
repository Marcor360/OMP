import { getFirebaseErrorMessage } from '@/src/lib/firebase/errors';

/** Convierte un error de Firebase/Firestore en un mensaje amigable */
export const formatFirestoreError = (error: unknown): string => {
  return getFirebaseErrorMessage(error);
};

/** Error generico para mostrar al usuario */
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

/** Lanza si condicion es falsa */
export const invariant = (condition: boolean, message: string): void => {
  if (!condition) throw new AppError(message);
};