import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';

import { auth } from '@/src/config/firebase/firebase';
import { LoginCredentials } from '@/src/types/auth.types';

/**
 * Inicia sesión con email y password.
 * Los errores de Firebase se propagan tal cual; el mapeo a mensaje de usuario
 * vive en src/lib/firebase/errors.ts.
 */
export const loginWithEmail = async (credentials: LoginCredentials): Promise<User> => {
  const userCredential = await signInWithEmailAndPassword(
    auth,
    credentials.email,
    credentials.password
  );
  return userCredential.user;
};

/**
 * Cierra sesión del usuario actual.
 */
export const logout = async (): Promise<void> => {
  await signOut(auth);
};
