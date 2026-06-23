import { firestoreUserRepository } from '@/src/services/repositories/firestore/firestore-user-repository';
import type {
  Unsubscribe,
  UserRepository,
} from '@/src/services/repositories/ports/user-repository.port';
import type {
  AppUser,
  CreateUserDTO,
  UpdateUserDTO,
} from '@/src/types/user';
import { createLogger } from '@/src/utils/logger';

export { normalizeUser, isIncompleteProfile } from './user.mapper';

const log = createLogger('users-service');

const USER_PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;

let userRepository: UserRepository = firestoreUserRepository;

export const __setUserRepositoryForTests = (repo: UserRepository): void => {
  userRepository = repo;
};

export const __resetUserRepositoryForTests = (): void => {
  userRepository = firestoreUserRepository;
};

/** Obtiene un usuario por UID */
export const getUserById = async (
  uid: string,
  options?: { forceServer?: boolean; maxAgeMs?: number }
): Promise<AppUser | null> => {
  if (!uid || typeof uid !== 'string') return null;

  return userRepository.getById(uid, options);
};

/** Perfil del usuario autenticado con estrategia cache-first */
export const getCurrentUserProfile = async (
  uid: string,
  options?: { forceServer?: boolean }
): Promise<AppUser | null> => {
  return getUserById(uid, {
    forceServer: options?.forceServer,
    maxAgeMs: USER_PROFILE_CACHE_TTL_MS,
  });
};

/** Obtiene todos los usuarios de una congregacion */
export const getAllUsers = async (
  congregationId: string,
  options?: { forceServer?: boolean }
): Promise<AppUser[]> => {
  if (!congregationId || typeof congregationId !== 'string') {
    return [];
  }

  return userRepository.getAllByCongregation(congregationId, options);
};

/** Obtiene usuarios activos de una congregacion */
export const getActiveUsers = async (congregationId: string): Promise<AppUser[]> => {
  if (!congregationId || typeof congregationId !== 'string') {
    return [];
  }

  return userRepository.getActiveByCongregation(congregationId);
};

/** Crea o actualiza el perfil de usuario en Firestore */
export const createUserProfile = async (
  uid: string,
  data: Omit<CreateUserDTO, 'password'>
): Promise<void> => {
  const isActive = data.isActive ?? true;

  const payload: Record<string, unknown> = {
    ...data,
    emailKey: data.email.trim().toLowerCase(),
    isElder: data.isElder ?? (data.privileges?.isElder === true),
    isMinisterialServant:
      data.isMinisterialServant ?? (data.privileges?.isMinisterialServant === true),
    isActive,
    status: isActive ? 'active' : 'inactive',
    createdBy: data.createdBy,
    createdByName: data.createdByName,
    createdByEmail: data.createdByEmail,
    updatedBy: data.updatedBy,
    updatedByName: data.updatedByName,
    updatedByEmail: data.updatedByEmail,
  };

  await userRepository.create(uid, payload);
};

/** Actualiza un usuario */
export const updateUser = async (
  uid: string,
  data: UpdateUserDTO
): Promise<void> => {
  const payload: Record<string, unknown> = {
    ...data,
  };

  if (typeof data.isActive === 'boolean' && !data.status) {
    payload.status = data.isActive ? 'active' : 'inactive';
  }

  if (data.status && typeof data.isActive !== 'boolean') {
    payload.isActive = data.status === 'active';
  }

  await userRepository.update(uid, payload);
};

/** Elimina un usuario de Firestore (no de Auth) */
export const deleteUser = async (uid: string): Promise<void> => {
  await userRepository.delete(uid);
};

export const getUsersCount = async (congregationId: string): Promise<number> => {
  if (!congregationId || typeof congregationId !== 'string') {
    return 0;
  }

  return userRepository.count(congregationId);
};

/** Suscripcion en tiempo real a usuarios por congregacion */
export const subscribeToUsers = (
  congregationId: string,
  callback: (users: AppUser[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe => {
  if (!congregationId || typeof congregationId !== 'string') {
    onError?.(new Error('No existe congregationId para cargar usuarios.'));
    return () => {};
  }

  let cancelled = false;

  void userRepository.getAllByCongregation(congregationId, { forceServer: true })
    .then((users) => {
      if (!cancelled) {
        callback(users);
      }
    })
    .catch((error) => {
      if (!cancelled) {
        log.error('subscribeToUsers error:', error);
        onError?.(error);
      }
    });

  return () => {
    cancelled = true;
  };
};

/** Suscripcion en tiempo real a un usuario especifico */
export const subscribeToUser = (
  uid: string,
  callback: (user: AppUser | null) => void,
  onError?: (error: unknown) => void
): Unsubscribe => {
  return userRepository.subscribeToUser(uid, callback, onError);
};
