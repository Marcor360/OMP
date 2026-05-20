import {
  AppUser,
  PermissionAction,
  PermissionDepartment,
  UserPermissions,
  UserRole,
  UserServiceAssignment,
} from '@/src/types/user';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 3,
  supervisor: 2,
  user: 1,
};

export const PERMISSION_DEPARTMENTS: PermissionDepartment[] = [
  'usuarios',
  'reuniones',
  'limpieza',
  'predicacion',
  'tesoreria',
  'pagos',
  'configuracion',
  'avisos',
  'asignaciones',
];

export const PERMISSION_ACTIONS: PermissionAction[] = [
  'view',
  'create',
  'edit',
  'delete',
  'manage',
  'approve',
  'export',
];

const FULL_DEPARTMENT_PERMISSIONS = {
  view: true,
  create: true,
  edit: true,
  delete: true,
  manage: true,
  approve: true,
  export: true,
} satisfies Record<PermissionAction, boolean>;

export const DEPARTMENT_LABELS: Record<PermissionDepartment, string> = {
  usuarios: 'Usuarios',
  reuniones: 'Reuniones',
  limpieza: 'Limpieza',
  predicacion: 'Predicacion',
  tesoreria: 'Tesoreria',
  pagos: 'Pagos',
  configuracion: 'Configuracion',
  avisos: 'Avisos',
  asignaciones: 'Asignaciones',
};

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'Ver',
  create: 'Crear',
  edit: 'Editar',
  delete: 'Eliminar',
  manage: 'Gestionar',
  approve: 'Aprobar',
  export: 'Exportar',
};

export const SUPERVISOR_PERMISSION_TEMPLATE: Partial<Record<PermissionDepartment, PermissionAction[]>> = {
  usuarios: ['view', 'create', 'edit', 'delete'],
  reuniones: ['view', 'create', 'edit', 'delete', 'manage'],
  limpieza: ['view', 'create', 'edit', 'delete', 'manage'],
  predicacion: ['view', 'approve', 'export', 'manage'],
  tesoreria: ['view', 'create', 'edit', 'delete', 'manage'],
  pagos: ['view', 'create', 'approve', 'manage'],
  configuracion: ['view', 'edit', 'manage'],
  avisos: ['view', 'create', 'edit', 'delete', 'manage'],
  asignaciones: ['view', 'create', 'edit', 'delete', 'manage'],
};

export const hasRole = (
  userRole: UserRole | undefined,
  requiredRole: UserRole
): boolean => {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
};

export const isAdmin = (user: Pick<AppUser, 'role'> | null | undefined): boolean =>
  user?.role === 'admin';

export const isSupervisor = (user: Pick<AppUser, 'role'> | null | undefined): boolean =>
  user?.role === 'supervisor';

const fullPermissions = (): UserPermissions =>
  PERMISSION_DEPARTMENTS.reduce<UserPermissions>((permissions, department) => {
    if (department === 'pagos') return permissions;
    permissions[department] = { ...FULL_DEPARTMENT_PERMISSIONS };
    return permissions;
  }, {});

export const mergePermissions = (...permissionSets: (UserPermissions | null | undefined)[]): UserPermissions =>
  permissionSets.reduce<UserPermissions>((merged, permissions) => {
    if (!permissions) return merged;

    PERMISSION_DEPARTMENTS.forEach((department) => {
      const departmentPermissions = permissions[department];
      if (!departmentPermissions) return;

      const target = merged[department] ?? {};
      PERMISSION_ACTIONS.forEach((action) => {
        if (departmentPermissions[action] === true) {
          target[action] = true;
        }
      });
      merged[department] = target;
    });

    return merged;
  }, {});

export const getDefaultPermissionsByRole = (role: UserRole | undefined): UserPermissions => {
  if (role === 'admin') return fullPermissions();
  if (role === 'user') {
    return {
      reuniones: { view: true },
      avisos: { view: true },
      predicacion: { create: true },
    };
  }
  return {};
};

const assignmentToPermissions = (assignment: Pick<UserServiceAssignment, 'position' | 'department'>): UserPermissions => {
  if (assignment.position === 'encargado' && assignment.department === 'limpieza') {
    return {
      limpieza: { view: true, create: true, edit: true, delete: true, manage: true },
    };
  }

  if (assignment.position === 'auxiliar' && assignment.department === 'limpieza') {
    return {
      limpieza: { view: true, edit: true },
    };
  }

  if (assignment.position === 'encargado' && assignment.department === 'tesoreria') {
    return {
      tesoreria: { view: true, create: true, edit: true, delete: true, manage: true },
      pagos: { view: true, create: true, approve: true, manage: true },
    };
  }

  if (assignment.position === 'auxiliar' && assignment.department === 'tesoreria') {
    return {
      tesoreria: { view: true, create: true, edit: true },
      pagos: { view: true },
    };
  }

  if (assignment.position === 'encargado' && assignment.department === 'predicacion') {
    return {
      predicacion: { view: true, approve: true, export: true, manage: true },
    };
  }

  if (assignment.position === 'auxiliar' && assignment.department === 'predicacion') {
    return {
      predicacion: { view: true, export: true },
    };
  }

  if (assignment.position === 'encargado' && assignment.department === 'reuniones') {
    return {
      reuniones: { view: true, create: true, edit: true, delete: true, manage: true },
    };
  }

  if (assignment.position === 'auxiliar' && assignment.department === 'reuniones') {
    return {
      reuniones: { view: true, edit: true },
    };
  }

  if (assignment.position === 'encargado' && assignment.department === 'discursos') {
    return {
      asignaciones: { view: true, create: true, edit: true, delete: true, manage: true },
    };
  }

  if (assignment.position === 'auxiliar' && assignment.department === 'discursos') {
    return {
      asignaciones: { view: true, edit: true },
    };
  }

  return {};
};

export const getPermissionsFromServiceAssignments = (
  user:
    | Pick<AppUser, 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'>
    | null
    | undefined
): UserPermissions => {
  const assignments: Pick<UserServiceAssignment, 'position' | 'department'>[] = [
    ...(user?.servicePosition
      ? [{ position: user.servicePosition, department: user.serviceDepartment }]
      : []),
    ...(user?.serviceAssignments ?? []),
  ];

  return mergePermissions(...assignments.map(assignmentToPermissions));
};

export const getEffectivePermissions = (
  user:
    | Pick<AppUser, 'role' | 'permissions' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'>
    | null
    | undefined
): UserPermissions =>
  mergePermissions(
    getDefaultPermissionsByRole(user?.role),
    user?.permissions,
    getPermissionsFromServiceAssignments(user)
  );

export const hasPermission = (
  user:
    | Pick<AppUser, 'role' | 'permissions' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'>
    | null
    | undefined,
  department: PermissionDepartment,
  action: PermissionAction
): boolean => {
  if (!user) return false;
  if (user.role === 'admin' && department !== 'pagos') return true;

  return getEffectivePermissions(user)[department]?.[action] === true;
};

export const canManageUsers = (user: Pick<AppUser, 'role' | 'permissions' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'> | null | undefined): boolean =>
  hasPermission(user, 'usuarios', 'manage') ||
  (
    hasPermission(user, 'usuarios', 'view') &&
    hasPermission(user, 'usuarios', 'create') &&
    hasPermission(user, 'usuarios', 'edit')
  );

export const canManageMeetings = (
  user: Pick<AppUser, 'role' | 'permissions' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'> | null | undefined
): boolean =>
  hasPermission(user, 'reuniones', 'manage') ||
  (
    hasPermission(user, 'reuniones', 'create') &&
    hasPermission(user, 'reuniones', 'edit')
  );

export const canManageAssignments = (
  user: Pick<AppUser, 'role' | 'permissions' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'> | null | undefined
): boolean =>
  hasPermission(user, 'asignaciones', 'manage') ||
  (
    hasPermission(user, 'asignaciones', 'create') &&
    hasPermission(user, 'asignaciones', 'edit')
  );

export const canManageOutgoingTalks = (
  profile:
    | Pick<AppUser, 'role' | 'permissions' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments' | 'isActive'>
    | null
    | undefined
): boolean => Boolean(profile?.isActive && canManageAssignments(profile));

export const canViewUsers = (
  user: Pick<AppUser, 'role' | 'permissions' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'> | null | undefined
): boolean => hasPermission(user, 'usuarios', 'view');

export const canAccessSettings = (
  user: Pick<AppUser, 'role' | 'permissions' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'> | null | undefined
): boolean =>
  hasPermission(user, 'configuracion', 'view') || hasPermission(user, 'configuracion', 'manage');

export const canManageCleaning = (
  user: Pick<AppUser, 'role' | 'permissions' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'> | null | undefined
): boolean =>
  hasPermission(user, 'limpieza', 'manage') ||
  (
    hasPermission(user, 'limpieza', 'create') &&
    hasPermission(user, 'limpieza', 'edit')
  );

export const canManageHospitality = (
  user: Pick<AppUser, 'role' | 'permissions' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'> | null | undefined
): boolean => canManageCleaning(user);

export const getVisibleTabs = (
  user:
    | Pick<AppUser, 'role' | 'permissions' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'>
    | null
    | undefined,
  isElder?: boolean
): ('index' | 'users' | 'meetings' | 'assignments' | 'profile' | 'settings' | 'cleaning' | 'preaching')[] => {
  const base = ['index', 'meetings', 'assignments', 'preaching', 'profile'] as const;
  const visible = new Set<typeof base[number] | 'users' | 'settings' | 'cleaning'>(base);

  if (canViewUsers(user)) visible.add('users');
  if (canAccessSettings(user)) visible.add('settings');
  if (hasPermission(user, 'limpieza', 'view') || canManageCleaning(user) || isElder) {
    visible.add('cleaning');
  }

  return Array.from(visible);
};

export const UNAUTHORIZED_MESSAGE =
  'No tienes permisos para realizar esta accion.';
