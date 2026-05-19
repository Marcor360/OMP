import { AppUser, UserRole } from '@/src/types/user';

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

export const canManageOutgoingTalks = (
  profile:
    | Pick<AppUser, 'role' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments' | 'isActive'>
    | null
    | undefined
): boolean =>
  Boolean(
    profile?.isActive &&
      (
        profile.role === 'admin' ||
        (
          profile.servicePosition === 'encargado' &&
          profile.serviceDepartment === 'discursos'
        ) ||
        profile.serviceAssignments?.some(
          (assignment) =>
            assignment.position === 'encargado' &&
            assignment.department === 'discursos'
        )
      )
  );

/** ¿Puede ver la sección de usuarios? (admin, supervisor o anciano) */
export const canViewUsers = (
  role: UserRole | undefined,
  isElder?: boolean
): boolean =>
  role === 'admin' || role === 'supervisor' || isElder === true;

/** ¿Puede acceder a configuración avanzada? */
export const canAccessSettings = (role: UserRole | undefined): boolean =>
  role === 'admin' || role === 'supervisor';

/** ¿ Puede gestionar grupos de limpieza? (admin, supervisor o encargado de servicio) */
export const canManageCleaning = (
  role: UserRole | undefined,
  servicePosition?: string | undefined,
  serviceDepartment?: string | undefined,
  serviceAssignments?: Pick<AppUser, 'serviceAssignments'>['serviceAssignments']
): boolean =>
  role === 'admin' ||
  role === 'supervisor' ||
  (servicePosition === 'encargado' &&
    (!serviceDepartment || serviceDepartment === 'limpieza')) ||
  serviceAssignments?.some(
    (assignment) =>
      assignment.position === 'encargado' &&
      (!assignment.department || assignment.department === 'limpieza')
  ) === true;

/** ¿Puede gestionar grupos de hospitalidad? (mismos permisos que limpieza) */
export const canManageHospitality = (
  role: UserRole | undefined,
  servicePosition?: string | undefined,
  serviceDepartment?: string | undefined,
  serviceAssignments?: Pick<AppUser, 'serviceAssignments'>['serviceAssignments']
): boolean => canManageCleaning(role, servicePosition, serviceDepartment, serviceAssignments);

/** Retorna las tabs visibles según el rol */
export const getVisibleTabs = (
  role: UserRole | undefined,
  servicePosition?: string | undefined,
  serviceDepartment?: string | undefined,
  serviceAssignments?: Pick<AppUser, 'serviceAssignments'>['serviceAssignments'],
  isElder?: boolean
): ('index' | 'users' | 'meetings' | 'assignments' | 'profile' | 'settings' | 'cleaning' | 'preaching')[] => {
  const base = ['index', 'meetings', 'assignments', 'preaching', 'profile'] as const;
  if (role === 'admin') {
    return [...base, 'users', 'settings', 'cleaning'];
  }
  if (role === 'supervisor') {
    return [...base, 'settings', 'cleaning'];
  }
  if (isElder) {
    return [...base, 'users', 'cleaning'];
  }
  if (canManageCleaning(role, servicePosition, serviceDepartment, serviceAssignments)) {
    return [...base, 'cleaning'];
  }
  return [...base];
};
/** Mensaje de error para acceso denegado */
export const UNAUTHORIZED_MESSAGE =
  'No tienes permisos para realizar esta acción.';
