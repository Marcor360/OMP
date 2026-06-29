import type { UserPrivileges } from '@/src/types/user';
import { hasErrors, validateMinLength, validateRequired } from '@/src/utils/validation/validation';
import type { UserFormErrors, UserFormMode } from '@/src/screens/users/user-form/user-form.types';

export type ValidateUserFormParams = {
  mode: UserFormMode;
  displayName: string;
  firstName: string;
  lastName: string;
  password: string;
  newPassword: string;
  hasGender: boolean;
  privileges: UserPrivileges;
};

export const getPrivilegesError = (privileges: UserPrivileges): string | undefined =>
  privileges.isRegularPioneer && privileges.isAuxiliaryPioneer
    ? 'Un usuario no puede ser Precursor Regular y Auxiliar al mismo tiempo.'
    : privileges.isElder && privileges.isMinisterialServant
      ? 'Un usuario no puede ser Anciano y Siervo Ministerial al mismo tiempo.'
      : undefined;

export const validateUserForm = (params: ValidateUserFormParams): UserFormErrors => {
  const assignmentError = undefined;
  const privilegesError = getPrivilegesError(params.privileges);

  return params.mode === 'create'
    ? {
        firstName: validateRequired(params.firstName, 'El primer nombre'),
        lastName: validateRequired(params.lastName, 'El apellido paterno'),
        password:
          validateRequired(params.password, 'La contrasena') ??
          validateMinLength(params.password, 6, 'La contrasena'),
        gender: params.hasGender ? undefined : 'El genero es requerido.',
        assignment: assignmentError,
        privileges: privilegesError,
      }
    : {
        displayName: validateRequired(params.displayName, 'El nombre'),
        newPassword:
          params.newPassword.trim().length > 0
            ? validateMinLength(params.newPassword, 6, 'La nueva contrasena')
            : undefined,
        gender: params.hasGender ? undefined : 'El genero es requerido.',
        assignment: assignmentError,
        privileges: privilegesError,
      };
};

export const hasUserFormErrors = (errors: UserFormErrors): boolean =>
  hasErrors(errors as Record<string, string | undefined>);
