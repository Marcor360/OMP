import {
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { auth } from '@/src/config/firebase/firebase';
import { LoginCredentials } from '@/src/types/auth.types';

/**
 * Inicia sesión con email y password
 */
export const loginWithEmail = async (credentials: LoginCredentials) => {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      credentials.email,
      credentials.password
    );
    return userCredential.user;
  } catch (error) {
    throw error;
  }
};

/**
 * Cierra sesión del usuario actual
 */
export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    throw error;
  }
};
