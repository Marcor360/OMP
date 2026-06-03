import type { AppUser } from '@/src/types/user';

type OrganizationPermissionUser = Pick<
  AppUser,
  'role' | 'isActive' | 'congregationId' | 'permissions' | 'servicePosition' | 'serviceAssignments'
>;

export const canViewOrganizationChart = (
  user: Pick<AppUser, 'isActive' | 'congregationId'> | null | undefined
): boolean =>
  Boolean(
    user?.isActive === true &&
      typeof user.congregationId === 'string' &&
      user.congregationId.trim().length > 0
  );

export const canManageOrganizationChart = (
  user: OrganizationPermissionUser | null | undefined
): boolean =>
  Boolean(
    user?.isActive === true &&
      typeof user.congregationId === 'string' &&
      user.congregationId.trim().length > 0 &&
      (
        user.role === 'admin' ||
        String(user.role) === 'administrador' ||
        user.servicePosition === 'coordinador' ||
        user.servicePosition === 'secretario' ||
        user.serviceAssignments?.some(
          (assignment) =>
            assignment.position === 'coordinador' ||
            assignment.position === 'secretario'
        ) ||
        user.permissions?.organigrama?.manage === true ||
        user.permissions?.departments?.manage === true
      )
  );
