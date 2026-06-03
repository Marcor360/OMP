import {
  AppUser,
  PermissionAction,
  PermissionDepartment,
  TerritoryPermissionAction,
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
  'departments',
  'predicacion',
  'tesoreria',
  'pagos',
  'configuracion',
  'avisos',
  'asignaciones',
  'organigrama',
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

export const TERRITORY_PERMISSION_ACTIONS: TerritoryPermissionAction[] = [
  'view',
  'create',
  'edit',
  'delete',
  'assign',
  'manage',
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
  departments: 'Organigrama',
  organigrama: 'Organigrama congregacional',
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

export const TERRITORY_ACTION_LABELS: Record<TerritoryPermissionAction, string> = {
  view: 'Ver predicacion',
  create: 'Crear territorios de predicacion',
  edit: 'Editar territorios de predicacion',
  delete: 'Desactivar territorios de predicacion',
  assign: 'Asignar territorios de predicacion',
  manage: 'Administrar predicacion',
};

export const SUPERVISOR_PERMISSION_TEMPLATE: Partial<Record<PermissionDepartment, PermissionAction[]>> = {
  usuarios: ['view', 'create', 'edit', 'delete'],
  reuniones: ['view', 'create', 'edit', 'delete', 'manage'],
  limpieza: ['view', 'create', 'edit', 'delete', 'manage'],
  departments: ['view', 'create', 'edit', 'delete', 'manage'],
  organigrama: ['view', 'create', 'edit', 'delete', 'manage'],
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

export const hasServiceAssignment = (
  user:
    | Pick<AppUser, 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'>
    | null
    | undefined,
  position: UserServiceAssignment['position'],
  department?: UserServiceAssignment['department']
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

export const hasGlobalScreenAccess = (
  user:
    | Pick<
        AppUser,
        | 'role'
        | 'servicePosition'
        | 'serviceDepartment'
        | 'serviceAssignments'
        | 'protectedFromDeletion'
        | 'isSystemUser'
        | 'isPrimaryAdmin'
        | 'isRootAdmin'
        | 'systemProtected'
      >
    | null
    | undefined
): boolean =>
  Boolean(
    user?.protectedFromDeletion === true ||
      user?.isSystemUser === true ||
      user?.isPrimaryAdmin === true ||
      user?.isRootAdmin === true ||
      user?.systemProtected === true ||
      hasServiceAssignment(user, 'coordinador') ||
      hasServiceAssignment(user, 'secretario')
  );

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
      if (department === 'predicacion' && departmentPermissions.territories) {
        const currentTerritories = target.territories ?? {};
        TERRITORY_PERMISSION_ACTIONS.forEach((action) => {
          if (departmentPermissions.territories?.[action] === true) {
            currentTerritories[action] = true;
          }
        });
        target.territories = currentTerritories;
      }
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

  if (
    assignment.position === 'encargado' &&
    (assignment.department === 'predicacion' || assignment.department === 'territorios')
  ) {
    return {
      predicacion: { view: true, approve: true, export: true, manage: true },
    };
  }

  if (
    assignment.position === 'auxiliar' &&
    (assignment.department === 'predicacion' || assignment.department === 'territorios')
  ) {
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
  isAdmin(user) ||
  hasPermission(user, 'usuarios', 'manage') ||
  (
    hasPermission(user, 'usuarios', 'view') &&
    hasPermission(user, 'usuarios', 'create') &&
    hasPermission(user, 'usuarios', 'edit')
  );

export const canManageMeetings = (
  user: Pick<AppUser, 'role' | 'permissions' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'> | null | undefined
): boolean =>
  isAdmin(user) ||
  hasPermission(user, 'reuniones', 'manage') ||
  (
    hasPermission(user, 'reuniones', 'create') &&
    hasPermission(user, 'reuniones', 'edit')
  );

export const canManageAssignments = (
  user: Pick<AppUser, 'role' | 'permissions' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'> | null | undefined
): boolean =>
  isAdmin(user) ||
  hasPermission(user, 'asignaciones', 'manage') ||
  (
    hasPermission(user, 'asignaciones', 'create') &&
    hasPermission(user, 'asignaciones', 'edit')
  );

export const canManageEvents = (
  user: Pick<AppUser, 'role' | 'permissions' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'> | null | undefined
): boolean =>
  isAdmin(user) ||
  hasPermission(user, 'avisos', 'manage') ||
  (
    hasPermission(user, 'avisos', 'create') &&
    hasPermission(user, 'avisos', 'edit')
  );

export const canManageOutgoingTalks = (
  profile:
    | Pick<AppUser, 'role' | 'permissions' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments' | 'isActive'>
    | null
    | undefined
): boolean => Boolean(profile?.isActive && canManageAssignments(profile));

export const canViewUsers = (
  user:
    | Pick<
        AppUser,
        | 'role'
        | 'permissions'
        | 'servicePosition'
        | 'serviceDepartment'
        | 'serviceAssignments'
        | 'protectedFromDeletion'
        | 'isSystemUser'
        | 'isPrimaryAdmin'
        | 'isRootAdmin'
        | 'systemProtected'
      >
    | null
    | undefined
): boolean =>
  isAdmin(user) ||
  isSupervisor(user) ||
  hasGlobalScreenAccess(user) ||
  user?.permissions?.departments?.manage === true ||
  hasPermission(user, 'usuarios', 'view') ||
  hasPermission(user, 'usuarios', 'manage');

export const canAccessSettings = (
  user:
    | Pick<
        AppUser,
        | 'role'
        | 'permissions'
        | 'servicePosition'
        | 'serviceDepartment'
        | 'serviceAssignments'
        | 'protectedFromDeletion'
        | 'isSystemUser'
        | 'isPrimaryAdmin'
        | 'isRootAdmin'
        | 'systemProtected'
      >
    | null
    | undefined
): boolean =>
  isAdmin(user) ||
  isSupervisor(user) ||
  hasGlobalScreenAccess(user) ||
  hasPermission(user, 'configuracion', 'view') ||
  hasPermission(user, 'configuracion', 'manage');

export const canViewCongregationModule = (
  user: Pick<AppUser, 'role' | 'isActive'> | null | undefined
): boolean => user?.isActive === true;

export const canViewOrgChart = (
  user: Pick<AppUser, 'isActive' | 'congregationId'> | null | undefined
): boolean =>
  Boolean(user?.isActive === true && typeof user.congregationId === 'string' && user.congregationId.trim().length > 0);

export const canManageDepartments = (
  user:
    | Pick<AppUser, 'role' | 'isActive' | 'congregationId' | 'permissions' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'>
    | null
    | undefined
): boolean =>
  Boolean(
    user?.isActive === true &&
      typeof user.congregationId === 'string' &&
      user.congregationId.trim().length > 0 &&
      (
        user.role === 'admin' ||
        String(user.role) === 'administrador' ||
        hasServiceAssignment(user, 'coordinador') ||
        hasServiceAssignment(user, 'secretario') ||
        user.permissions?.departments?.manage === true ||
        user.permissions?.organigrama?.manage === true
      )
  );

export const canManageOrgChart = canManageDepartments;

export const canManageCleaning = (
  user: Pick<AppUser, 'role' | 'permissions' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'> | null | undefined
): boolean =>
  isAdmin(user) ||
  hasPermission(user, 'limpieza', 'manage') ||
  (
    hasPermission(user, 'limpieza', 'create') &&
    hasPermission(user, 'limpieza', 'edit')
  );

export const canManageHospitality = (
  user: Pick<AppUser, 'role' | 'permissions' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'> | null | undefined
): boolean => canManageCleaning(user);

const hasPreachingAssignment = (
  user:
    | Pick<AppUser, 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'>
    | null
    | undefined,
  position: 'encargado' | 'auxiliar'
): boolean =>
  Boolean(
    (
      user?.servicePosition === position &&
      (user.serviceDepartment === 'predicacion' || user.serviceDepartment === 'territorios')
    ) ||
      user?.serviceAssignments?.some(
        (assignment) =>
          assignment.position === position &&
          (assignment.department === 'predicacion' || assignment.department === 'territorios')
      )
  );

export const hasTerritoryPermission = (
  user:
    | Pick<AppUser, 'role' | 'permissions' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'>
    | null
    | undefined,
  action: TerritoryPermissionAction
): boolean => {
  if (!user) return false;
  if (action === 'view') return true;
  if (user.role === 'admin') return true;
  if (hasPreachingAssignment(user, 'encargado')) return true;

  const preachingPermissions = getEffectivePermissions(user).predicacion;
  if (preachingPermissions?.manageTerritories === true) return true;
  if (preachingPermissions?.territories?.manage === true) return true;
  return preachingPermissions?.territories?.[action] === true;
};

export const canViewTerritories = (
  user: Pick<AppUser, 'isActive' | 'congregationId'> | null | undefined
): boolean =>
  Boolean(user?.isActive === true && typeof user.congregationId === 'string' && user.congregationId.trim().length > 0);

export const canManageTerritoryCatalog = (
  user:
    | Pick<AppUser, 'role' | 'permissions' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'>
    | null
    | undefined
): boolean =>
  isAdmin(user) ||
  hasPreachingAssignment(user, 'encargado') ||
  hasTerritoryPermission(user, 'create') ||
  hasTerritoryPermission(user, 'edit') ||
  hasTerritoryPermission(user, 'delete');

export const canManagePreachingGroups = (
  user:
    | Pick<AppUser, 'role' | 'permissions' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'>
    | null
    | undefined
): boolean =>
  isAdmin(user) ||
  hasPreachingAssignment(user, 'encargado') ||
  getEffectivePermissions(user).predicacion?.territories?.manage === true;

export const canAssignMonthlyTerritories = (
  user:
    | Pick<AppUser, 'role' | 'permissions' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'>
    | null
    | undefined
): boolean =>
  isAdmin(user) ||
  hasPreachingAssignment(user, 'encargado') ||
  hasTerritoryPermission(user, 'assign');

export const canManageTerritories = (
  user:
    | Pick<AppUser, 'role' | 'permissions' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'>
    | null
    | undefined
): boolean =>
  canManageTerritoryCatalog(user) ||
  canManagePreachingGroups(user) ||
  canAssignMonthlyTerritories(user) ||
  hasPermission(user, 'predicacion', 'manage') ||
  getEffectivePermissions(user).predicacion?.manageTerritories === true;

export const getVisibleTabs = (
  user:
    | Pick<
        AppUser,
        | 'role'
        | 'isActive'
        | 'permissions'
        | 'servicePosition'
        | 'serviceDepartment'
        | 'serviceAssignments'
        | 'protectedFromDeletion'
        | 'isSystemUser'
        | 'isPrimaryAdmin'
        | 'isRootAdmin'
        | 'systemProtected'
      >
    | null
    | undefined,
  _isElder?: boolean
): ('index' | 'users' | 'meetings' | 'assignments' | 'profile' | 'settings' | 'cleaning' | 'preaching' | 'org-chart')[] => {
  const base = ['index', 'meetings', 'assignments', 'preaching', 'org-chart', 'profile'] as const;
  const visible = new Set<typeof base[number] | 'users' | 'settings' | 'cleaning'>(base);

  if (canViewUsers(user)) visible.add('users');
  if (canAccessSettings(user)) visible.add('settings');
  if (canViewCongregationModule(user)) {
    visible.add('cleaning');
  }

  return Array.from(visible);
};

export const UNAUTHORIZED_MESSAGE =
  'No tienes permisos para realizar esta accion.';
