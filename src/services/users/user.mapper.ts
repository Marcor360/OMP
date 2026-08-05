import {
  AppUser,
  USER_SERVICE_DEPARTMENT_LABELS,
  UserGender,
  UserPermissions,
  UserRole,
  UserServiceAssignment,
  UserServiceDepartment,
  UserServicePosition,
  UserStatus,
} from '@/src/types/user';
import { PERMISSION_ACTIONS, PERMISSION_DEPARTMENTS } from '@/src/utils/permissions/permissions';

const isUserRole = (value: unknown): value is UserRole =>
  value === 'admin' || value === 'supervisor' || value === 'user';

const isUserStatus = (value: unknown): value is UserStatus =>
  value === 'active' || value === 'inactive' || value === 'suspended';

const isUserGender = (value: unknown): value is UserGender =>
  value === 'masculino' || value === 'femenino';

const normalizeRole = (value: unknown): UserRole => {
  if (isUserRole(value)) return value;
  if (typeof value !== 'string') return 'user';

  const normalized = value.trim().toLowerCase();
  if (normalized === 'admin' || normalized === 'administrador') return 'admin';
  if (normalized === 'supervisor') return 'supervisor';
  if (normalized === 'user' || normalized === 'usuario') return 'user';

  return 'user';
};

const normalizeStatus = (value: unknown): UserStatus | undefined => {
  if (isUserStatus(value)) return value;
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim().toLowerCase();
  if (normalized === 'active' || normalized === 'activo') return 'active';
  if (normalized === 'inactive' || normalized === 'inactivo') return 'inactive';
  if (normalized === 'suspended' || normalized === 'suspendido') return 'suspended';

  return undefined;
};

const isUserServicePosition = (value: unknown): value is UserServicePosition => {
  return (
    value === 'coordinador' ||
    value === 'secretario' ||
    value === 'encargado' ||
    value === 'auxiliar' ||
    value === 'apoyo'
  );
};

const isUserServiceDepartment = (value: unknown): value is UserServiceDepartment => {
  return (
    value === 'coordinacion' ||
    value === 'secretaria' ||
    value === 'limpieza' ||
    value === 'literatura' ||
    value === 'tesoreria' ||
    value === 'mantenimiento' ||
    value === 'discursos' ||
    value === 'reuniones' ||
    value === 'predicacion' ||
    value === 'territorios' ||
    value === 'asignaciones' ||
    value === 'hospitalidad' ||
    value === 'usuarios' ||
    value === 'configuracion' ||
    value === 'audio_video' ||
    value === 'acomodadores_microfonos'
  );
};

const buildDepartmentLabel = (
  position?: UserServicePosition,
  department?: UserServiceDepartment
): string | undefined => {
  if (position === 'coordinador') return 'Coordinador';
  if (position === 'secretario') return 'Secretario';
  if (position === 'encargado' && department) {
    return `Encargado de ${USER_SERVICE_DEPARTMENT_LABELS[department]}`;
  }
  if (position === 'auxiliar' && department) {
    return `Auxiliar de ${USER_SERVICE_DEPARTMENT_LABELS[department]}`;
  }
  if (position === 'apoyo' && department) {
    return `Apoyo de ${USER_SERVICE_DEPARTMENT_LABELS[department]}`;
  }

  return undefined;
};

const normalizeServiceAssignment = (value: unknown): UserServiceAssignment | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const position = isUserServicePosition(source.position) ? source.position : undefined;
  if (!position) return null;
  const department = isUserServiceDepartment(source.department) ? source.department : undefined;
  const label = buildDepartmentLabel(position, department);
  if (!label) return null;
  return { position, department, label };
};

const normalizeServiceAssignments = (
  value: unknown,
  fallbackPosition?: UserServicePosition,
  fallbackDepartment?: UserServiceDepartment
): UserServiceAssignment[] => {
  const normalized = Array.isArray(value)
    ? value
        .map(normalizeServiceAssignment)
        .filter((item): item is UserServiceAssignment => Boolean(item))
    : [];
  const byKey = new Map<string, UserServiceAssignment>();
  normalized.forEach((item) => {
    byKey.set(`${item.position}:${item.department ?? ''}`, item);
  });

  const fallbackLabel = buildDepartmentLabel(fallbackPosition, fallbackDepartment);
  if (fallbackPosition && fallbackLabel) {
    byKey.set(`${fallbackPosition}:${fallbackDepartment ?? ''}`, {
      position: fallbackPosition,
      department: fallbackDepartment,
      label: fallbackLabel,
    });
  }

  return Array.from(byKey.values());
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
};

const normalizeBooleanMap = <TKeys extends string>(
  value: unknown,
  keys: readonly TKeys[]
): Partial<Record<TKeys, boolean>> | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;

  const source = value as Record<string, unknown>;
  const normalized = keys.reduce<Partial<Record<TKeys, boolean>>>((acc, key) => {
    if (typeof source[key] === 'boolean') {
      acc[key] = source[key] as boolean;
    }
    return acc;
  }, {});

  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const normalizePermissions = (value: unknown): UserPermissions | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;

  const source = value as Record<string, unknown>;
  const permissions = PERMISSION_DEPARTMENTS.reduce<UserPermissions>((acc, department) => {
    const rawDepartment = source[department];
    if (typeof rawDepartment !== 'object' || rawDepartment === null || Array.isArray(rawDepartment)) {
      return acc;
    }

    const rawActions = rawDepartment as Record<string, unknown>;
    const normalized = PERMISSION_ACTIONS.reduce<Record<string, boolean>>((actions, action) => {
      if (typeof rawActions[action] === 'boolean') {
        actions[action] = rawActions[action] as boolean;
      }
      return actions;
    }, {});

    if (Object.keys(normalized).length > 0) {
      acc[department] = normalized;
    }

    return acc;
  }, {});

  return Object.keys(permissions).length > 0 ? permissions : undefined;
};

const SYSTEM_ACTOR_LABEL = 'Sistema Sistema';

const normalizeActorLabel = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (
    trimmed === 'system' ||
    trimmed === 'sistema' ||
    trimmed === 'tu_correo@gmail.com'
  ) {
    return SYSTEM_ACTOR_LABEL;
  }

  return trimmed;
};

export const normalizeUser = (uid: string, data: Record<string, unknown>): AppUser => {
  const role = normalizeRole(data.role);
  const normalizedStatus = normalizeStatus(data.status);
  const isActive =
    typeof data.isActive === 'boolean'
      ? data.isActive
      : typeof data.active === 'boolean'
        ? data.active
      : normalizedStatus === 'active';
  const status = normalizedStatus
    ? normalizedStatus
    : isActive
      ? 'active'
      : 'inactive';
  const servicePosition = isUserServicePosition(data.servicePosition)
    ? data.servicePosition
    : undefined;
  const serviceDepartment = isUserServiceDepartment(data.serviceDepartment)
    ? data.serviceDepartment
    : undefined;
  const computedDepartment = buildDepartmentLabel(servicePosition, serviceDepartment);
  const serviceAssignments = normalizeServiceAssignments(
    data.serviceAssignments,
    servicePosition,
    serviceDepartment
  );
  const normalizedPrivileges = normalizeBooleanMap(data.privileges, [
    'isElder',
    'isMinisterialServant',
    'isRegularPioneer',
    'isAuxiliaryPioneer',
  ] as const);
  const privileges = {
    ...(normalizedPrivileges ?? {}),
    ...(normalizedPrivileges?.isElder === undefined && typeof data.isElder === 'boolean'
      ? { isElder: data.isElder }
      : {}),
    ...(normalizedPrivileges?.isMinisterialServant === undefined && typeof data.isMinisterialServant === 'boolean'
      ? { isMinisterialServant: data.isMinisterialServant }
      : {}),
  };
  const normalizedPrivilegesForUser = Object.keys(privileges).length > 0 ? privileges : undefined;
  const isElder =
    typeof normalizedPrivilegesForUser?.isElder === 'boolean'
      ? normalizedPrivilegesForUser.isElder
      : data.isElder === true;
  const isMinisterialServant =
    typeof normalizedPrivilegesForUser?.isMinisterialServant === 'boolean'
      ? normalizedPrivilegesForUser.isMinisterialServant
      : data.isMinisterialServant === true;
  const responsibilities = normalizeBooleanMap(data.responsibilities, [
    'isPreachingManager',
  ] as const);
  const permissions = normalizePermissions(data.permissions);

  return {
    uid,
    email: typeof data.email === 'string' ? data.email : '',
    displayName:
      typeof data.displayName === 'string' && data.displayName.trim().length > 0
        ? data.displayName
        : typeof data.email === 'string' && data.email.trim().length > 0
          ? data.email
          : 'Usuario',
    role,
    congregationId: typeof data.congregationId === 'string' ? data.congregationId : '',
    isActive,
    status,
    phone: typeof data.phone === 'string' ? data.phone : undefined,
    gender: isUserGender(data.gender) ? data.gender : undefined,
    department:
      computedDepartment ??
      (typeof data.department === 'string' && data.department.trim().length > 0
        ? data.department
        : undefined),
    servicePosition,
    serviceDepartment,
    serviceAssignments,
    privileges: normalizedPrivilegesForUser,
    responsibilities,
    permissions,
    isElder,
    isMinisterialServant,
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : undefined,
    // Campos del modulo de limpieza
    cleaningEligible: typeof data.cleaningEligible === 'boolean' ? data.cleaningEligible : true,
    cleaningGroupId:
      typeof data.cleaningGroupId === 'string' && data.cleaningGroupId.length > 0
        ? data.cleaningGroupId
        : null,
    cleaningGroupName:
      typeof data.cleaningGroupName === 'string' && data.cleaningGroupName.length > 0
        ? data.cleaningGroupName
        : null,
    // Campos de notificaciones
    notificationTokens: normalizeStringArray(data.notificationTokens),
    notificationsEnabled: data.notificationsEnabled !== false,
    platformNotifications: data.platformNotifications !== false,
    cleaningNotifications: data.cleaningNotifications !== false,
    hospitalityNotifications: data.hospitalityNotifications !== false,
    eventsNotifications: data.eventsNotifications !== false,
    createdBy: normalizeActorLabel(data.createdBy),
    createdByName: normalizeActorLabel(data.createdByName),
    createdByEmail: normalizeActorLabel(data.createdByEmail),
    updatedBy: normalizeActorLabel(data.updatedBy),
    updatedByName: normalizeActorLabel(data.updatedByName),
    updatedByEmail: normalizeActorLabel(data.updatedByEmail),
    protectedFromDeletion:
      typeof data.protectedFromDeletion === 'boolean' ? data.protectedFromDeletion : undefined,
    isSystemUser: typeof data.isSystemUser === 'boolean' ? data.isSystemUser : undefined,
    isPrimaryAdmin: typeof data.isPrimaryAdmin === 'boolean' ? data.isPrimaryAdmin : undefined,
    isRootAdmin: typeof data.isRootAdmin === 'boolean' ? data.isRootAdmin : undefined,
    systemProtected: typeof data.systemProtected === 'boolean' ? data.systemProtected : undefined,
    createdAt: data.createdAt as AppUser['createdAt'],
    updatedAt: data.updatedAt as AppUser['updatedAt'],
  };
};

export const isIncompleteProfile = (user: AppUser): boolean =>
  user.uid.trim().length === 0 || user.congregationId.trim().length === 0;
