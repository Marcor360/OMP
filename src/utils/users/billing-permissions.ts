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
  department?: UserServiceDepartment
): boolean =>
  Boolean(
    (
      user?.servicePosition === position &&
      (department === undefined || user.serviceDepartment === department)
    ) ||
      user?.serviceAssignments?.some(
        (assignment) =>
          assignment.position === position &&
          (department === undefined || assignment.department === department)
      )
  );

export const isTreasuryManager = (
  user: BillingUser | null | undefined
): boolean => hasServiceAssignment(user, 'encargado', 'tesoreria');

export const isAssistantTreasury = (
  user: BillingUser | null | undefined
): boolean => hasServiceAssignment(user, 'auxiliar', 'tesoreria');

export const isCoordinatorOrSecretary = (
  user: BillingUser | null | undefined
): boolean =>
  hasServiceAssignment(user, 'coordinador') ||
  hasServiceAssignment(user, 'secretario');

const hasExplicitBillingOperationPermission = (
  user: BillingUser | null | undefined
): boolean => hasPermission(user, 'pagos', 'create') || hasPermission(user, 'pagos', 'manage');

export const canViewBilling = (
  user: BillingUser | null | undefined
): boolean =>
  user?.role === 'admin' ||
  hasPermission(user, 'pagos', 'view') ||
  isCoordinatorOrSecretary(user) ||
  isTreasuryManager(user) ||
  isAssistantTreasury(user);

export const canPaySubscription = (
  user: BillingUser | null | undefined
): boolean =>
  isCoordinatorOrSecretary(user) ||
  isTreasuryManager(user) ||
  (
    isAssistantTreasury(user) &&
    hasExplicitBillingOperationPermission(user)
  ) ||
  hasExplicitBillingOperationPermission(user);

export const canManageSubscription = (
  user: BillingUser | null | undefined
): boolean => canPaySubscription(user);

export const canCancelSubscription = (
  user: BillingUser | null | undefined
): boolean => hasPermission(user, 'pagos', 'manage');
