/**
 * Fase 0 — materializacion de permisos derivados del cargo (position x department).
 * PURO: prohibido importar firebase, firebase-admin o react-native aqui, igual
 * que functions/src/shared/cleaning-access.ts.
 *
 * Puerto EXACTO de assignmentToPermissions / getPermissionsFromServiceAssignments /
 * mergePermissions de src/utils/permissions/permissions.ts:178-321. Copia fiel a
 * proposito: cualquier divergencia entre este archivo y el frontend reintroduce
 * el bug que Fase 0 cierra (permisos derivados que dicen una cosa en el
 * frontend y otra en el backend). Si la tabla cambia alla, cambia aqui tambien
 * en el mismo PR.
 */

export type PermissionDepartment =
  | 'usuarios'
  | 'reuniones'
  | 'limpieza'
  | 'departments'
  | 'predicacion'
  | 'tesoreria'
  | 'pagos'
  | 'configuracion'
  | 'avisos'
  | 'asignaciones'
  | 'acomodadores_microfonos'
  | 'organigrama';

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'manage'
  | 'approve'
  | 'export';

export type TerritoryPermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'assign' | 'manage';

export type DepartmentPermissions = Partial<Record<PermissionAction, boolean>> & {
  territories?: Partial<Record<TerritoryPermissionAction, boolean>>;
};

export type UserPermissions = Partial<Record<PermissionDepartment, DepartmentPermissions>>;

export type ServiceAssignmentLike = {
  position?: string;
  department?: string;
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
  'acomodadores_microfonos',
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

export const mergePermissions = (
  ...permissionSets: (UserPermissions | null | undefined)[]
): UserPermissions =>
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

// Espejo exacto de UserServiceDepartment en src/types/user/index.ts. Solo para
// tipar SERVICE_DEPARTMENT_PERMISSION_DECISIONS abajo -- este modulo es PURO y
// no puede importar el tipo real del proyecto frontend.
type UserServiceDepartment =
  | 'coordinacion'
  | 'secretaria'
  | 'limpieza'
  | 'literatura'
  | 'tesoreria'
  | 'mantenimiento'
  | 'discursos'
  | 'reuniones'
  | 'predicacion'
  | 'territorios'
  | 'asignaciones'
  | 'hospitalidad'
  | 'usuarios'
  | 'configuracion'
  | 'audio_video'
  | 'acomodadores_microfonos';

/**
 * Decision explicita para cada departamento de servicio. Espejo exacto de
 * SERVICE_DEPARTMENT_PERMISSION_DECISIONS en
 * src/utils/permissions/permissions.ts. Copia fiel, sin "mejoras" -- misma
 * razon que assignmentToPermissions abajo.
 *
 * null  -> mapeado en assignmentToPermissions()
 * string -> deliberadamente sin permisos derivados; el string es el motivo.
 */
export const SERVICE_DEPARTMENT_PERMISSION_DECISIONS: Record<UserServiceDepartment, string | null> = {
  limpieza: null,
  tesoreria: null,
  predicacion: null,
  reuniones: null,
  discursos: null,
  acomodadores_microfonos: null,
  asignaciones: null,
  hospitalidad: null,
  territorios: null,
  literatura: 'Sin modulo en la app: un permiso hacia el no gatea nada.',
  mantenimiento: 'Sin modulo en la app: un permiso hacia el no gatea nada.',
  audio_video: 'Es un rol dentro de la lista de acomodadores, no un modulo propio.',
  usuarios: 'DELIBERADO por seguridad: ver nota abajo. Delegacion solo explicita.',
  configuracion: 'DELIBERADO por seguridad: misma razon que usuarios.',
  coordinacion:
    'Ya recibe acceso global via hasGlobalScreenAccess()/canManageDepartments(), que ' +
    'evaluan la posicion "coordinador" sin importar el departamento. Mapearlo aqui ' +
    'duplicaria un camino que ya esta cubierto.',
  secretaria:
    'Ya recibe acceso global via hasGlobalScreenAccess()/canManageDepartments(), que ' +
    'evaluan la posicion "secretario" sin importar el departamento. Mapearlo aqui ' +
    'duplicaria un camino que ya esta cubierto.',
};

// NOTA DE SEGURIDAD sobre 'usuarios' y 'configuracion':
// hasPermission('usuarios', ...) gatea crear, editar y borrar usuarios, y
// MODIFICAR LOS PERMISOS DE OTROS (rules_src/06-user-permissions.rules:20-30).
// Derivarlo de un cargo convertiria "asignar encargado de usuarios" en una
// escalada de privilegios silenciosa: esa persona podria otorgarse cualquier
// permiso a si misma. La delegacion aqui es explicita a proposito.

// Tabla completa position x department -> permisos otorgados. Espejo exacto de
// assignmentToPermissions en src/utils/permissions/permissions.ts:219-305.
export const assignmentToPermissions = (assignment: ServiceAssignmentLike): UserPermissions => {
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

  if (assignment.position === 'encargado' && assignment.department === 'asignaciones') {
    return {
      asignaciones: { view: true, create: true, edit: true, delete: true, manage: true },
    };
  }

  if (assignment.position === 'auxiliar' && assignment.department === 'asignaciones') {
    return {
      asignaciones: { view: true, edit: true },
    };
  }

  if (
    assignment.position === 'encargado' &&
    (assignment.department === 'acomodadores_microfonos' || assignment.department === 'hospitalidad')
  ) {
    return {
      acomodadores_microfonos: { view: true, create: true, edit: true, manage: true },
      asignaciones: { view: true, create: true, edit: true, manage: true },
      reuniones: { view: true, edit: true },
    };
  }

  if (
    assignment.position === 'auxiliar' &&
    (assignment.department === 'acomodadores_microfonos' || assignment.department === 'hospitalidad')
  ) {
    return {
      acomodadores_microfonos: { view: true, edit: true },
      asignaciones: { view: true, edit: true },
      reuniones: { view: true, edit: true },
    };
  }

  return {};
};

// Espejo exacto de getPermissionsFromServiceAssignments en
// src/utils/permissions/permissions.ts:307-321.
export const getPermissionsFromServiceAssignments = (
  user:
    | {
        servicePosition?: string;
        serviceDepartment?: string;
        serviceAssignments?: ServiceAssignmentLike[];
      }
    | null
    | undefined
): UserPermissions => {
  const assignments: ServiceAssignmentLike[] = [
    ...(user?.servicePosition
      ? [{ position: user.servicePosition, department: user.serviceDepartment }]
      : []),
    ...(user?.serviceAssignments ?? []),
  ];

  return mergePermissions(...assignments.map(assignmentToPermissions));
};

// Compara dos UserPermissions por valor (no por referencia), ignorando el orden
// de insercion de claves. Usada por el trigger para evitar escrituras sin
// cambio real (derivedPermissions calculado == almacenado).
export const permissionsEqual = (
  left: UserPermissions | null | undefined,
  right: UserPermissions | null | undefined
): boolean => {
  const normalize = (permissions: UserPermissions | null | undefined): string => {
    const departments = PERMISSION_DEPARTMENTS.map((department) => {
      const dept = permissions?.[department];
      if (!dept) return null;
      const actions = PERMISSION_ACTIONS.filter((action) => dept[action] === true);
      const territories = dept.territories
        ? TERRITORY_PERMISSION_ACTIONS.filter((action) => dept.territories?.[action] === true)
        : [];
      if (actions.length === 0 && territories.length === 0) return null;
      return [department, actions.join(','), territories.join(',')].join(':');
    }).filter((entry): entry is string => entry !== null);

    return departments.join('|');
  };

  return normalize(left) === normalize(right);
};
