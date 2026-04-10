import { httpsCallable } from 'firebase/functions';

import { functions } from '@/src/lib/firebase/app';
import { isFirebaseErrorCode } from '@/src/lib/firebase/errors';
import { deleteUser, updateUser } from '@/src/services/users/users-service';
import { UpdateUserDTO, UserServiceDepartment, UserServicePosition } from '@/src/types/user';
import { AppError } from '@/src/utils/errors/errors';

export type CreateUserByAdminPayload = {
  firstName: string;
  middleName?: string;
  lastName: string;
  password: string;
  displayName?: string;
  email?: string;
  role: 'admin' | 'supervisor' | 'user';
  congregationId: string;
  isActive?: boolean;
  phone?: string;
  department?: string;
  servicePosition?: UserServicePosition;
  serviceDepartment?: UserServiceDepartment;
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

export const updateUserByAdmin = async (payload: UpdateUserByAdminPayload): Promise<void> => {
  try {
    await callFunction<UpdateUserByAdminPayload, unknown>('updateUserByAdmin', payload);
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
  } catch (error) {
    if (isFunctionUnavailable(error)) {
      await updateUser(uid, { isActive: false, status: 'inactive' });
      return;
    }

    throw error;
  }
};

export const deleteUserByAdmin = async ({ uid }: ToggleUserByAdminPayload): Promise<void> => {
  try {
    await callFunction<ToggleUserByAdminPayload, unknown>('deleteUserByAdmin', { uid });
  } catch (error) {
    if (isFunctionUnavailable(error)) {
      // Fallback temporal: elimina solo el documento de Firestore.
      await deleteUser(uid);
      return;
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
