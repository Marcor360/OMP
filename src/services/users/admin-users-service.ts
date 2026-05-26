import { httpsCallable } from 'firebase/functions';

import { functions } from '@/src/lib/firebase/app';
import { isFirebaseErrorCode } from '@/src/lib/firebase/errors';
import { invalidateCacheEntry } from '@/src/services/repositories/firestore-cache-first';
import { clearSessionCacheByPrefix } from '@/src/services/repositories/session-cache';
import { updateUser } from '@/src/services/users/users-service';
import {
  UpdateUserDTO,
  UserPrivileges,
  UserResponsibilities,
  UserServiceDepartment,
  UserServiceAssignment,
  UserServicePosition,
  UserGender,
  UserPermissions,
} from '@/src/types/user';
import { AppError } from '@/src/utils/errors/errors';

export type CreateUserByAdminPayload = {
  firstName: string;
  middleName?: string;
  lastName: string;
  secondLastName?: string;
  password: string;
  displayName?: string;
  email?: string;
  role: 'admin' | 'supervisor' | 'user';
  congregationId: string;
  isActive?: boolean;
  phone?: string;
  gender?: UserGender;
  department?: string;
  servicePosition?: UserServicePosition;
  serviceDepartment?: UserServiceDepartment;
  serviceAssignments?: UserServiceAssignment[];
  privileges?: UserPrivileges;
  responsibilities?: UserResponsibilities;
  permissions?: UserPermissions;
  isElder?: boolean;
  isMinisterialServant?: boolean;
};

export type CreateUserByAdminResult = {
  uid: string;
  email: string;
  requiredDomain: string;
};

type UpdateUserByAdminPayload = {
  uid: string;
  data: UpdateUserDTO;
};

type UpdateUserByAdminResult = {
  ok?: boolean;
  user?: {
    uid?: string;
    role?: string;
    servicePosition?: UserServicePosition;
    serviceDepartment?: UserServiceDepartment;
    serviceAssignments?: UserServiceAssignment[];
    privileges?: UserPrivileges;
    isElder?: boolean;
    isMinisterialServant?: boolean;
  };
};

type ToggleUserByAdminPayload = {
  uid: string;
};

type UpdateUserPasswordByAdminPayload = {
  uid: string;
  newPassword: string;
};

const callFunction = async <TRequest extends object, TResponse>(
  name: string,
  payload: TRequest
): Promise<TResponse> => {
  const callable = httpsCallable<TRequest, TResponse>(functions, name);
  const result = await callable(payload);
  return result.data;
};

const isFunctionUnavailable = (error: unknown): boolean => {
  return isFirebaseErrorCode(error, 'unimplemented') || isFirebaseErrorCode(error, 'not-found');
};

export const createUserByAdmin = async (
  payload: CreateUserByAdminPayload
): Promise<CreateUserByAdminResult> => {
  try {
    const result = await callFunction<CreateUserByAdminPayload, Partial<CreateUserByAdminResult>>(
      'createUserByAdmin',
      payload
    );

    if (!result || typeof result.uid !== 'string') {
      throw new AppError(
        'No se pudo confirmar la creacion del usuario. Verifica que Cloud Functions este desplegado.'
      );
    }

    clearSessionCacheByPrefix('query:users/');

    return {
      uid: result.uid,
      email: result.email ?? payload.email ?? '',
      requiredDomain: result.requiredDomain ?? (payload.email?.split('@').pop() ?? ''),
    };
  } catch (error) {
    if (isFunctionUnavailable(error)) {
      throw new AppError(
        'La operacion de crear usuario requiere Cloud Functions (createUserByAdmin) y no esta disponible.'
      );
    }

    throw error;
  }
};

export const updateUserByAdmin = async (
  payload: UpdateUserByAdminPayload
): Promise<UpdateUserByAdminResult | void> => {
  try {
    const result = await callFunction<UpdateUserByAdminPayload, UpdateUserByAdminResult>(
      'updateUserByAdmin',
      payload
    );
    invalidateCacheEntry(`users/${payload.uid}`);
    clearSessionCacheByPrefix('query:users/');
    return result;
  } catch (error) {
    if (isFunctionUnavailable(error)) {
      // Fallback temporal: actualiza solo el documento de Firestore.
      await updateUser(payload.uid, payload.data);
      return;
    }

    throw error;
  }
};

export const disableUserByAdmin = async ({ uid }: ToggleUserByAdminPayload): Promise<void> => {
  try {
    await callFunction<ToggleUserByAdminPayload, unknown>('disableUserByAdmin', { uid });
    invalidateCacheEntry(`users/${uid}`);
    clearSessionCacheByPrefix('query:users/');
  } catch (error) {
    if (isFunctionUnavailable(error)) {
      throw new AppError(
        'La operacion de desactivar usuario requiere Cloud Functions (disableUserByAdmin) y no esta disponible.'
      );
    }

    throw error;
  }
};

export const deleteUserByAdmin = async ({ uid }: ToggleUserByAdminPayload): Promise<void> => {
  try {
    await callFunction<ToggleUserByAdminPayload, unknown>('deleteUserByAdmin', { uid });
    invalidateCacheEntry(`users/${uid}`);
    clearSessionCacheByPrefix('query:users/');
  } catch (error) {
    if (isFunctionUnavailable(error)) {
      throw new AppError(
        'La operacion de eliminar usuario requiere Cloud Functions (deleteUserByAdmin) y no esta disponible.'
      );
    }

    throw error;
  }
};

export const updateUserPasswordByAdmin = async (
  payload: UpdateUserPasswordByAdminPayload
): Promise<void> => {
  try {
    await callFunction<UpdateUserPasswordByAdminPayload, unknown>('updateUserPasswordByAdmin', payload);
  } catch (error) {
    if (isFunctionUnavailable(error)) {
      throw new AppError(
        'La operacion de cambiar contrasena requiere Cloud Functions (updateUserPasswordByAdmin) y no esta disponible.'
      );
    }

    throw error;
  }
};
