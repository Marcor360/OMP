import type {
  AppUser,
  PermissionAction,
  PermissionDepartment,
  TerritoryPermissionAction,
  UserPermissions,
  UserRole,
  UserServiceAssignment,
} from '@/src/types/user';
import {
  ACTION_LABELS,
  DEPARTMENT_LABELS,
  getEffectivePermissions,
  hasPermission,
  TERRITORY_ACTION_LABELS,
} from '@/src/utils/permissions/permissions';
import type { UserFormMode } from '@/src/screens/users/user-form/user-form.types';

export const canEditUserForm = (
  appUser: AppUser | null | undefined,
  mode: UserFormMode
): boolean =>
  mode === 'create'
    ? hasPermission(appUser, 'usuarios', 'create') || hasPermission(appUser, 'usuarios', 'manage')
    : hasPermission(appUser, 'usuarios', 'edit') || hasPermission(appUser, 'usuarios', 'manage');

export const getUserFormEffectivePermissions = (params: {
  role: UserRole;
  permissions: UserPermissions;
  serviceAssignments: UserServiceAssignment[];
}): UserPermissions =>
  getEffectivePermissions({
    role: params.role,
    permissions: params.role === 'supervisor' ? params.permissions : undefined,
    servicePosition: params.serviceAssignments[0]?.position,
    serviceDepartment: params.serviceAssignments[0]?.department,
    serviceAssignments: params.serviceAssignments,
  });

export const getAllowedPermissionLabels = (permissions: UserPermissions): string[] =>
  Object.entries(permissions)
    .map(([department, actions]) => {
      const enabledActions = Object.entries(actions ?? {})
        .filter(([action, enabled]) => action !== 'territories' && enabled === true)
        .map(([action]) => ACTION_LABELS[action as PermissionAction]);
      const territoryActions = Object.entries(actions?.territories ?? {})
        .filter(([, enabled]) => enabled === true)
        .map(([action]) => TERRITORY_ACTION_LABELS[action as TerritoryPermissionAction]);
      const labels = [...enabledActions, ...territoryActions];

      return labels.length > 0
        ? `${DEPARTMENT_LABELS[department as PermissionDepartment]}: ${labels.join(', ')}`
        : null;
    })
    .filter((item): item is string => Boolean(item));
