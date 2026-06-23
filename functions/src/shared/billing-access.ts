/**
 * Fuente UNICA de autorizacion de facturacion (billing).
 * PURO: prohibido importar firebase, firebase-admin o react-native aqui.
 * Las REGLAS viven una sola vez. La resolucion del permiso 'pagos' se inyecta
 * (front = permisos efectivos; backend = mapa crudo). Converger esa resolucion
 * es la fase 2b (requiere dry-run; puede otorgar/quitar acceso real).
 */
export type BillingServicePosition =
  | 'coordinador' | 'secretario' | 'encargado' | 'auxiliar' | 'apoyo';

export type BillingServiceDepartment =
  | 'coordinacion' | 'secretaria' | 'limpieza' | 'literatura' | 'tesoreria'
  | 'mantenimiento' | 'discursos' | 'reuniones' | 'predicacion' | 'territorios'
  | 'asignaciones' | 'hospitalidad' | 'usuarios' | 'configuracion'
  | 'audio_video' | 'acomodadores_microfonos';

export type BillingPagosAction = 'view' | 'create' | 'manage';

export interface BillingServiceAssignment {
  position?: BillingServicePosition | string;
  department?: BillingServiceDepartment | string;
}

export interface BillingUser {
  role?: 'admin' | 'supervisor' | 'user' | string;
  servicePosition?: BillingServicePosition | string;
  serviceDepartment?: BillingServiceDepartment | string;
  serviceAssignments?: BillingServiceAssignment[];
}

/** Resolucion de 'pagos' inyectada por cada plataforma (rica en front, cruda en backend). */
export interface BillingAccessDeps {
  hasPagosPermission: (action: BillingPagosAction) => boolean;
}

export const hasServiceAssignment = (
  user: BillingUser | null | undefined,
  position: BillingServicePosition,
  department?: BillingServiceDepartment
): boolean =>
  Boolean(
    (user?.servicePosition === position &&
      (department === undefined || user.serviceDepartment === department)) ||
      user?.serviceAssignments?.some(
        (a) =>
          a.position === position &&
          (department === undefined || a.department === department)
      )
  );

export const isTreasuryManager = (user: BillingUser | null | undefined): boolean =>
  hasServiceAssignment(user, 'encargado', 'tesoreria');

export const isAssistantTreasury = (user: BillingUser | null | undefined): boolean =>
  hasServiceAssignment(user, 'auxiliar', 'tesoreria');

export const isCoordinatorOrSecretary = (user: BillingUser | null | undefined): boolean =>
  hasServiceAssignment(user, 'coordinador') || hasServiceAssignment(user, 'secretario');

const hasExplicitBillingOperationPermission = (deps: BillingAccessDeps): boolean =>
  deps.hasPagosPermission('create') || deps.hasPagosPermission('manage');

/** Puede operar cobros (checkout / cancelar). */
export const canOperateBilling = (
  user: BillingUser | null | undefined,
  deps: BillingAccessDeps
): boolean =>
  isCoordinatorOrSecretary(user) ||
  isTreasuryManager(user) ||
  (isAssistantTreasury(user) && hasExplicitBillingOperationPermission(deps)) ||
  hasExplicitBillingOperationPermission(deps);

/** Puede ver facturacion. DECISION OPCION A: operar => ver. (asistente de tesoreria siempre ve) */
export const canViewBilling = (
  user: BillingUser | null | undefined,
  deps: BillingAccessDeps
): boolean =>
  user?.role === 'admin' ||
  deps.hasPagosPermission('view') ||
  isCoordinatorOrSecretary(user) ||
  isTreasuryManager(user) ||
  isAssistantTreasury(user) ||
  hasExplicitBillingOperationPermission(deps);

/** Puede cancelar la suscripcion (gate de UI del front). */
export const canManageBilling = (deps: BillingAccessDeps): boolean =>
  deps.hasPagosPermission('manage');
