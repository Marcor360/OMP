import {
  AppUser,
  UserServiceDepartment,
  UserServicePosition,
} from '@/src/types/user';
import { hasPermission } from '@/src/utils/permissions/permissions';
import {
  BillingPagosAction,
  BillingUser,
  canManageBilling as sharedCanManage,
  canOperateBilling as sharedCanOperate,
  canViewBilling as sharedCanView,
  hasServiceAssignment as sharedHasServiceAssignment,
  isAssistantTreasury as sharedIsAssistantTreasury,
  isCoordinatorOrSecretary as sharedIsCoordinatorOrSecretary,
  isTreasuryManager as sharedIsTreasuryManager,
} from '@/functions/src/shared/billing-access';

type FrontBillingUser = Pick<
  AppUser,
  'role' | 'permissions' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'
>;

const toBillingUser = (user: FrontBillingUser | null | undefined): BillingUser | null =>
  user
    ? {
        role: user.role,
        servicePosition: user.servicePosition,
        serviceDepartment: user.serviceDepartment,
        serviceAssignments: user.serviceAssignments,
      }
    : null;

// Inyecta la resolucion RICA del front (permisos efectivos via hasPermission central).
const depsFor = (
  user: FrontBillingUser | null | undefined
): { hasPagosPermission: (action: BillingPagosAction) => boolean } => ({
  hasPagosPermission: (action) => hasPermission(user, 'pagos', action),
});

export const hasServiceAssignment = (
  user: FrontBillingUser | null | undefined,
  position: UserServicePosition,
  department?: UserServiceDepartment
): boolean => sharedHasServiceAssignment(toBillingUser(user), position, department);

export const isTreasuryManager = (user: FrontBillingUser | null | undefined): boolean =>
  sharedIsTreasuryManager(toBillingUser(user));

export const isAssistantTreasury = (user: FrontBillingUser | null | undefined): boolean =>
  sharedIsAssistantTreasury(toBillingUser(user));

export const isCoordinatorOrSecretary = (user: FrontBillingUser | null | undefined): boolean =>
  sharedIsCoordinatorOrSecretary(toBillingUser(user));

export const canViewBilling = (user: FrontBillingUser | null | undefined): boolean =>
  sharedCanView(toBillingUser(user), depsFor(user));

export const canPaySubscription = (user: FrontBillingUser | null | undefined): boolean =>
  sharedCanOperate(toBillingUser(user), depsFor(user));

export const canManageSubscription = (user: FrontBillingUser | null | undefined): boolean =>
  canPaySubscription(user);

export const canCancelSubscription = (user: FrontBillingUser | null | undefined): boolean =>
  sharedCanManage(depsFor(user));
