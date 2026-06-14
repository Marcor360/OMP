type Role = 'admin' | 'supervisor' | 'user';
type ServicePosition = 'coordinador' | 'secretario' | 'encargado' | 'auxiliar';
type ServiceDepartment =
  | 'limpieza'
  | 'literatura'
  | 'tesoreria'
  | 'mantenimiento'
  | 'discursos'
  | 'reuniones'
  | 'predicacion'
  | 'audio_video'
  | 'acomodadores_microfonos';

type ServiceAssignment = {
  position?: ServicePosition;
  department?: ServiceDepartment;
};

type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'manage' | 'approve' | 'export';
type PermissionDepartment =
  | 'usuarios'
  | 'reuniones'
  | 'limpieza'
  | 'predicacion'
  | 'tesoreria'
  | 'pagos'
  | 'configuracion'
  | 'avisos'
  | 'asignaciones';
type UserPermissions = Partial<Record<PermissionDepartment, Partial<Record<PermissionAction, boolean>>>>;

type BillingUser = {
  role?: Role;
  permissions?: UserPermissions;
  servicePosition?: ServicePosition;
  serviceDepartment?: ServiceDepartment;
  serviceAssignments?: ServiceAssignment[];
};

export const hasServiceAssignment = (
  user: BillingUser | null | undefined,
  position: ServicePosition,
  department?: ServiceDepartment
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

const hasPermission = (
  user: BillingUser | null | undefined,
  department: PermissionDepartment,
  action: PermissionAction
): boolean =>
  user?.permissions?.[department]?.[action] === true ||
  user?.permissions?.[department]?.manage === true;

const isCoordinatorOrSecretary = (
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
