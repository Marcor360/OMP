import {
  AppUser,
  UserServiceDepartment,
  UserServicePosition,
} from '@/src/types/user';
import { hasPermission } from '@/src/utils/permissions/permissions';

type BillingUser = Pick<
  AppUser,
  'role' | 'permissions' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'
>;

export const hasServiceAssignment = (
  user: BillingUser | null | undefined,
  position: UserServicePosition,
  department: UserServiceDepartment
): boolean =>
  Boolean(
    (
      user?.servicePosition === position &&
      user.serviceDepartment === department
    ) ||
      user?.serviceAssignments?.some(
        (assignment) =>
          assignment.position === position &&
          assignment.department === department
      )
  );

export const isTreasuryManager = (
  user: BillingUser | null | undefined
): boolean => hasServiceAssignment(user, 'encargado', 'tesoreria');

export const isAssistantTreasury = (
  user: BillingUser | null | undefined
): boolean => hasServiceAssignment(user, 'auxiliar', 'tesoreria');

export const canViewBilling = (
  user: BillingUser | null | undefined
): boolean =>
  hasPermission(user, 'pagos', 'view') || isTreasuryManager(user) || isAssistantTreasury(user);

export const canPaySubscription = (
  user: BillingUser | null | undefined
): boolean =>
  hasPermission(user, 'pagos', 'create') || isTreasuryManager(user);

export const canManageSubscription = (
  user: BillingUser | null | undefined
): boolean => hasPermission(user, 'pagos', 'manage') || isTreasuryManager(user);

export const canCancelSubscription = (
  user: BillingUser | null | undefined
): boolean => hasPermission(user, 'pagos', 'manage');
