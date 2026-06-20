import type { AppUser } from '@/src/types/user';
import { canManageOrgChart } from '@/src/utils/permissions/permissions';

type OrganizationPermissionUser = Pick<
  AppUser,
  | 'role'
  | 'isActive'
  | 'congregationId'
  | 'permissions'
  | 'servicePosition'
  | 'serviceDepartment'
  | 'serviceAssignments'
  | 'protectedFromDeletion'
  | 'isSystemUser'
  | 'isPrimaryAdmin'
  | 'isRootAdmin'
  | 'systemProtected'
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
): boolean => canManageOrgChart(user);
