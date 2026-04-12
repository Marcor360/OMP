import { UserRole } from '@/src/types/user';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 3,
  supervisor: 2,
  user: 1,
};

/** Verifica si el rol del usuario es al menos el rol requerido */
export const hasRole = (
  userRole: UserRole | undefined,
  requiredRole: UserRole
): boolean => {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
};

/** ¿Puede gestionar (crear/editar/eliminar) usuarios? */
export const canManageUsers = (role: UserRole | undefined): boolean =>
  role === 'admin';

/** ¿Puede crear/editar reuniones? */
export const canManageMeetings = (role: UserRole | undefined): boolean =>
  role === 'admin' || role === 'supervisor';

/** ¿Puede crear/editar asignaciones? */
export const canManageAssignments = (role: UserRole | undefined): boolean =>
  role === 'admin' || role === 'supervisor';

/** ¿Puede ver la sección de usuarios? */
export const canViewUsers = (role: UserRole | undefined): boolean =>
  role === 'admin' || role === 'supervisor';

/** ¿Puede acceder a configuración avanzada? */
export const canAccessSettings = (role: UserRole | undefined): boolean =>
  role === 'admin' || role === 'supervisor';

/** ¿Puede gestionar grupos de limpieza? (admin, supervisor o encargado de servicio) */
export const canManageCleaning = (
  role: UserRole | undefined,
  servicePosition?: string | undefined
): boolean =>
  role === 'admin' || role === 'supervisor' || servicePosition === 'encargado';

/** Retorna las tabs visibles según el rol */
export const getVisibleTabs = (
  role: UserRole | undefined
): Array<'index' | 'users' | 'meetings' | 'assignments' | 'profile' | 'settings' | 'cleaning'> => {
  const base = ['index', 'meetings', 'assignments', 'profile'] as const;
  if (role === 'admin') {
    return [...base, 'users', 'settings', 'cleaning'];
  }
  if (role === 'supervisor') {
    return [...base, 'settings', 'cleaning'];
  }
  return [...base];
};

/** Mensaje de error para acceso denegado */
export const UNAUTHORIZED_MESSAGE =
  'No tienes permisos para realizar esta acción.';
