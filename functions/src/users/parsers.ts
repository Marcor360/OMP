import { HttpsError } from 'firebase-functions/v2/https';
import { SYSTEM_ACTOR_LABEL } from '../user-protection.js';
import {
  PERMISSION_ACTIONS,
  PERMISSION_DEPARTMENTS,
  SERVICE_DEPARTMENT_LABEL_TO_KEY,
  SERVICE_DEPARTMENT_LABELS,
  TERRITORY_PERMISSION_ACTIONS,
} from './constants.js';
import type {
  CreateUserPayload,
  DepartmentPermissions,
  Gender,
  ListUsersPayload,
  PermissionAction,
  PermissionDepartment,
  RequesterProfile,
  Role,
  ServiceAssignment,
  ServiceDepartment,
  ServicePosition,
  StoredServiceAssignment,
  TerritoryPermissionAction,
  UpdatePasswordPayload,
  UpdateUserPayload,
  UserPermissions,
  UserPrivileges,
  UserResponsibilities,
} from './types.js';

export function assertValidRole(role: unknown): asserts role is Role {
  if (role !== 'admin' && role !== 'supervisor' && role !== 'user') {
    throw new HttpsError('invalid-argument', 'Rol invalido.');
  }
}

export function normalizeRole(value: unknown): Role | undefined {
  if (value === 'admin' || value === 'supervisor' || value === 'user') return value;
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim().toLowerCase();
  if (normalized === 'administrador') return 'admin';
  if (normalized === 'usuario') return 'user';
  return undefined;
}

export const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const resolveActorName = (
  actor: Pick<RequesterProfile, 'displayName' | 'email'> | null | undefined,
  fallbackUid: string
): string => {
  const name = normalizeText(actor?.displayName);
  const email = normalizeText(actor?.email);

  if (!name && (!email || email === 'tu_correo@gmail.com')) {
    return SYSTEM_ACTOR_LABEL;
  }

  if (email === 'tu_correo@gmail.com') {
    return SYSTEM_ACTOR_LABEL;
  }

  return name ?? email ?? fallbackUid;
};

export const resolveActorEmail = (
  actor: Pick<RequesterProfile, 'email'> | null | undefined
): string => {
  const email = normalizeText(actor?.email);
  return email === 'tu_correo@gmail.com' ? SYSTEM_ACTOR_LABEL : (email ?? '');
};

export const parseServicePosition = (value: unknown): ServicePosition | undefined => {
  const text = normalizeText(value);
  if (!text) return undefined;
  if (text === 'coordinador' || text === 'secretario' || text === 'encargado' || text === 'auxiliar') {
    return text;
  }
  throw new HttpsError('invalid-argument', 'Asignacion de servicio invalida.');
};

export const parseGender = (value: unknown): Gender | undefined => {
  const text = normalizeText(value);
  if (!text) return undefined;
  if (text === 'masculino' || text === 'femenino') return text;
  throw new HttpsError('invalid-argument', 'Genero invalido.');
};

export const parseServiceDepartment = (value: unknown): ServiceDepartment | undefined => {
  const text = normalizeText(value);
  if (!text) return undefined;

  if (
    text === 'coordinacion' ||
    text === 'secretaria' ||
    text === 'limpieza' ||
    text === 'literatura' ||
    text === 'tesoreria' ||
    text === 'mantenimiento' ||
    text === 'discursos' ||
    text === 'reuniones' ||
    text === 'predicacion' ||
    text === 'territorios' ||
    text === 'asignaciones' ||
    text === 'hospitalidad' ||
    text === 'usuarios' ||
    text === 'configuracion' ||
    text === 'audio_video' ||
    text === 'acomodadores_microfonos'
  ) {
    return text;
  }

  throw new HttpsError('invalid-argument', 'Departamento de servicio invalido.');
};

export const parseBooleanMap = <TKeys extends string>(
  value: unknown,
  keys: readonly TKeys[],
  label: string
): Partial<Record<TKeys, boolean>> | undefined => {
  if (value === undefined || value === null) return undefined;

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', `${label} invalido.`);
  }

  const source = value as Record<string, unknown>;
  const invalidKey = Object.keys(source).find((key) => !keys.includes(key as TKeys));
  if (invalidKey) {
    throw new HttpsError('invalid-argument', `${label} contiene campos no permitidos.`);
  }

  const normalized = keys.reduce<Partial<Record<TKeys, boolean>>>((acc, key) => {
    if (source[key] !== undefined) {
      if (typeof source[key] !== 'boolean') {
        throw new HttpsError('invalid-argument', `${label} debe contener valores booleanos.`);
      }
      acc[key] = source[key] as boolean;
    }
    return acc;
  }, {});

  return Object.keys(normalized).length > 0 ? normalized : {};
};

export const parsePrivileges = (value: unknown): UserPrivileges | undefined => {
  const privileges = parseBooleanMap(
    value,
    ['isElder', 'isMinisterialServant', 'isRegularPioneer', 'isAuxiliaryPioneer'] as const,
    'Privilegios'
  ) as UserPrivileges | undefined;

  if (privileges?.isRegularPioneer && privileges?.isAuxiliaryPioneer) {
    throw new HttpsError(
      'invalid-argument',
      'Un usuario no puede ser Precursor Regular y Auxiliar al mismo tiempo.'
    );
  }

  if (privileges?.isElder && privileges?.isMinisterialServant) {
    throw new HttpsError(
      'invalid-argument',
      'Un usuario no puede ser Anciano y Siervo Ministerial al mismo tiempo.'
    );
  }

  return privileges;
};

export const parsePrivilegesWithLegacyFlags = (
  value: unknown,
  source: Record<string, unknown>
): UserPrivileges | undefined => {
  const privileges = parsePrivileges(value);
  const isElderProvided = typeof source.isElder === 'boolean';
  const isMinisterialServantProvided = typeof source.isMinisterialServant === 'boolean';

  if (!isElderProvided && !isMinisterialServantProvided) {
    return privileges;
  }

  const merged: UserPrivileges = { ...(privileges ?? {}) };

  if (isElderProvided) {
    merged.isElder = source.isElder as boolean;
  }

  if (isMinisterialServantProvided) {
    merged.isMinisterialServant = source.isMinisterialServant as boolean;
  }

  if (merged.isElder && merged.isMinisterialServant) {
    throw new HttpsError(
      'invalid-argument',
      'Un usuario no puede ser Anciano y Siervo Ministerial al mismo tiempo.'
    );
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
};

export const parseResponsibilities = (value: unknown): UserResponsibilities | undefined =>
  parseBooleanMap(
    value,
    ['isPreachingManager'] as const,
    'Responsabilidades'
  ) as UserResponsibilities | undefined;

export const parsePermissions = (
  value: unknown,
  options?: { strict?: boolean }
): UserPermissions | undefined => {
  const strict = options?.strict !== false;
  if (value === undefined || value === null) return undefined;

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    if (!strict) return undefined;
    throw new HttpsError('invalid-argument', 'Permisos invalidos.');
  }

  const source = value as Record<string, unknown>;
  const invalidDepartment = Object.keys(source).find(
    (department) => !PERMISSION_DEPARTMENTS.includes(department as PermissionDepartment)
  );
  if (strict && invalidDepartment) {
    throw new HttpsError('invalid-argument', 'Permisos contienen departamentos no permitidos.');
  }

  const permissions = PERMISSION_DEPARTMENTS.reduce<UserPermissions>((acc, department) => {
    const rawDepartment = source[department];
    if (rawDepartment === undefined) return acc;

    if (typeof rawDepartment !== 'object' || rawDepartment === null || Array.isArray(rawDepartment)) {
      if (!strict) return acc;
      throw new HttpsError('invalid-argument', 'Permisos por departamento invalidos.');
    }

    const rawActions = rawDepartment as Record<string, unknown>;
    const invalidAction = Object.keys(rawActions).find(
      (action) =>
        !PERMISSION_ACTIONS.includes(action as PermissionAction) &&
        !(department === 'predicacion' && (action === 'territories' || action === 'manageTerritories'))
    );
    if (strict && invalidAction) {
      throw new HttpsError('invalid-argument', 'Permisos contienen acciones no permitidas.');
    }

    const actions = PERMISSION_ACTIONS.reduce<DepartmentPermissions>((normalized, action) => {
      if (rawActions[action] !== undefined) {
        if (typeof rawActions[action] !== 'boolean') {
          if (!strict) return normalized;
          throw new HttpsError('invalid-argument', 'Los permisos deben ser booleanos.');
        }
        normalized[action] = rawActions[action] as boolean;
      }
      return normalized;
    }, {});

    if (department === 'predicacion' && rawActions.territories !== undefined) {
      if (
        typeof rawActions.territories !== 'object' ||
        rawActions.territories === null ||
        Array.isArray(rawActions.territories)
      ) {
        if (!strict) return acc;
        throw new HttpsError('invalid-argument', 'Permisos de territorios invalidos.');
      }

      const rawTerritories = rawActions.territories as Record<string, unknown>;
      const invalidTerritoryAction = Object.keys(rawTerritories).find(
        (action) => !TERRITORY_PERMISSION_ACTIONS.includes(action as TerritoryPermissionAction)
      );
      if (strict && invalidTerritoryAction) {
        throw new HttpsError('invalid-argument', 'Permisos de territorios contienen acciones no permitidas.');
      }

      const territories = TERRITORY_PERMISSION_ACTIONS.reduce<Partial<Record<TerritoryPermissionAction, boolean>>>(
        (normalized, action) => {
          if (rawTerritories[action] !== undefined) {
            if (typeof rawTerritories[action] !== 'boolean') {
              if (!strict) return normalized;
              throw new HttpsError('invalid-argument', 'Los permisos de territorios deben ser booleanos.');
            }
            normalized[action] = rawTerritories[action] as boolean;
          }
          return normalized;
        },
        {}
      );

      if (Object.keys(territories).length > 0) {
        actions.territories = territories;
      }
    }

    if (department === 'predicacion' && rawActions.manageTerritories !== undefined) {
      if (typeof rawActions.manageTerritories !== 'boolean') {
        if (!strict) return acc;
        throw new HttpsError('invalid-argument', 'El permiso de administrar territorios debe ser booleano.');
      }
      actions.manageTerritories = rawActions.manageTerritories;
    }

    if (Object.keys(actions).length > 0) {
      acc[department] = actions;
    }

    return acc;
  }, {});

  return Object.keys(permissions).length > 0 ? permissions : {};
};

export const parseLegacyAssignmentLabel = (
  label: string | undefined
): { position?: ServicePosition; department?: ServiceDepartment } => {
  if (!label) return {};
  if (label === 'Coordinador') return { position: 'coordinador' };
  if (label === 'Secretario') return { position: 'secretario' };
  if (label.startsWith('Encargado de ')) {
    const normalizedLabel = label.replace('Encargado de ', '').trim();
    const department = SERVICE_DEPARTMENT_LABEL_TO_KEY[normalizedLabel];
    return department ? { position: 'encargado', department } : {};
  }
  if (label.startsWith('Auxiliar de ')) {
    const normalizedLabel = label.replace('Auxiliar de ', '').trim();
    const department = SERVICE_DEPARTMENT_LABEL_TO_KEY[normalizedLabel];
    return department ? { position: 'auxiliar', department } : {};
  }
  return {};
};

export const buildServiceAssignmentLabel = (position?: ServicePosition, department?: ServiceDepartment): string | undefined => {
  if (!position) return undefined;
  if (position === 'coordinador') return 'Coordinador';
  if (position === 'secretario') return 'Secretario';

  if (!department) return undefined;
  const departmentLabel = SERVICE_DEPARTMENT_LABELS[department];
  if (position === 'encargado') return `Encargado de ${departmentLabel}`;
  if (position === 'auxiliar') return `Auxiliar de ${departmentLabel}`;

  return undefined;
};

export const requiresAdminElderPosition = (position?: ServicePosition): boolean =>
  position === 'coordinador' || position === 'secretario';

export const serviceAssignmentsRequireAdminElder = (
  assignments: Pick<StoredServiceAssignment, 'position'>[]
): boolean =>
  assignments.some((assignment) => requiresAdminElderPosition(assignment.position));

export const rawServiceAssignmentsRequireAdminElder = (value: unknown): boolean => {
  if (!Array.isArray(value)) return false;

  return value.some((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return false;
    const position = parseServicePosition((item as Record<string, unknown>).position);
    return requiresAdminElderPosition(position);
  });
};

export const ensureAdminElderPrivileges = (
  privileges: UserPrivileges | undefined,
  shouldRequire: boolean
): UserPrivileges | undefined =>
  shouldRequire
    ? {
      ...(privileges ?? {}),
      isElder: true,
      isMinisterialServant: false,
    }
    : privileges;

export const normalizeAssignmentForRole = (
  role: Role,
  position?: ServicePosition,
  department?: ServiceDepartment
): ServiceAssignment => {
  if (!position) {
    return {};
  }

  if ((position === 'coordinador' || position === 'secretario') && role !== 'admin') {
    throw new HttpsError(
      'invalid-argument',
      'Solo usuarios con rol admin pueden ser Coordinador o Secretario.'
    );
  }

  if (position === 'encargado' || position === 'auxiliar') {
    if (!department) {
      throw new HttpsError(
        'invalid-argument',
        `El departamento es obligatorio para ${position === 'encargado' ? 'Encargado' : 'Auxiliar'}.`
      );
    }
  } else if (department) {
    throw new HttpsError(
      'invalid-argument',
      'Coordinador y Secretario no deben tener departamento.'
    );
  }

  return {
    position,
    department,
    label: buildServiceAssignmentLabel(position, department),
  };
};

export const normalizeStoredAssignmentForRole = (
  role: Role,
  position?: ServicePosition,
  department?: ServiceDepartment
): StoredServiceAssignment | null => {
  const assignment = normalizeAssignmentForRole(role, position, department);
  if (!assignment.position || !assignment.label) return null;
  const stored: StoredServiceAssignment = {
    position: assignment.position,
    label: assignment.label,
  };
  if (assignment.department) {
    stored.department = assignment.department;
  }
  return stored;
};

export const parseServiceAssignments = (
  value: unknown,
  role: Role,
  fallback?: ServiceAssignment
): StoredServiceAssignment[] => {
  const byKey = new Map<string, StoredServiceAssignment>();

  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        throw new HttpsError('invalid-argument', 'Funciones congregacionales invalidas.');
      }
      const record = item as Record<string, unknown>;
      const normalized = normalizeStoredAssignmentForRole(
        role,
        parseServicePosition(record.position),
        parseServiceDepartment(record.department)
      );
      if (normalized) {
        byKey.set(`${normalized.position}:${normalized.department ?? ''}`, normalized);
      }
    });
  }

  const fallbackStored = normalizeStoredAssignmentForRole(
    role,
    fallback?.position,
    fallback?.department
  );
  if (fallbackStored) {
    byKey.set(`${fallbackStored.position}:${fallbackStored.department ?? ''}`, fallbackStored);
  }

  const assignments = Array.from(byKey.values()).slice(0, 20);
  const hasCoordinator = assignments.some((assignment) => assignment.position === 'coordinador');
  const hasSecretary = assignments.some((assignment) => assignment.position === 'secretario');

  if (hasCoordinator && hasSecretary) {
    throw new HttpsError(
      'failed-precondition',
      'Una misma persona no puede ser Coordinador y Secretario a la vez.'
    );
  }

  return assignments;
};

export const parseListUsersPayload = (value: unknown): ListUsersPayload => {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', 'Solicitud invalida.');
  }

  const source = value as Record<string, unknown>;
  return {
    activeOnly: source.activeOnly === true,
  };
};

export const parseCreateUserPayload = (raw: unknown): CreateUserPayload => {
  if (typeof raw !== 'object' || raw === null) {
    throw new HttpsError('invalid-argument', 'Payload invalido.');
  }

  const data = raw as Record<string, unknown>;

  const firstName = normalizeText(data.firstName);
  const middleName = normalizeText(data.middleName) ?? normalizeText(data.secondName);
  const lastName = normalizeText(data.lastName);
  const secondLastName = normalizeText(data.secondLastName);
  const displayName =
    normalizeText(data.displayName) ?? [firstName, middleName, lastName, secondLastName].filter(Boolean).join(' ').trim();
  const congregationId = normalizeText(data.congregationId);
  const password = normalizeText(data.password);
  const gender = parseGender(data.gender);

  const missingFields = [
    !firstName ? 'primer nombre' : undefined,
    !lastName ? 'apellido paterno' : undefined,
    !displayName ? 'nombre completo' : undefined,
    !congregationId ? 'congregacion' : undefined,
    !password ? 'contrasena' : undefined,
  ].filter(Boolean);

  if (missingFields.length > 0) {
    throw new HttpsError(
      'invalid-argument',
      `Faltan datos requeridos para crear usuario: ${missingFields.join(', ')}.`
    );
  }

  const requiredFirstName = firstName as string;
  const requiredLastName = lastName as string;
  const requiredDisplayName = displayName as string;
  const requiredCongregationId = congregationId as string;
  const requiredPassword = password as string;

  const requestedRole = data.role;
  assertValidRole(requestedRole);

  if (requiredPassword.length < 6) {
    throw new HttpsError('invalid-argument', 'La contrasena debe tener al menos 6 caracteres.');
  }

  const legacyAssignment = parseLegacyAssignmentLabel(normalizeText(data.department));
  const rawPosition = parseServicePosition(data.servicePosition) ?? legacyAssignment.position;
  const rawDepartment = parseServiceDepartment(data.serviceDepartment) ?? legacyAssignment.department;
  const role: Role =
    requiresAdminElderPosition(rawPosition) || rawServiceAssignmentsRequireAdminElder(data.serviceAssignments)
      ? 'admin'
      : requestedRole;
  const assignment = normalizeAssignmentForRole(role, rawPosition, rawDepartment);
  const serviceAssignments = parseServiceAssignments(data.serviceAssignments, role, assignment);
  const primaryAssignment = serviceAssignments[0] ?? assignment;
  const privileges = ensureAdminElderPrivileges(
    parsePrivilegesWithLegacyFlags(data.privileges, data),
    serviceAssignmentsRequireAdminElder(serviceAssignments)
  );
  const responsibilities = parseResponsibilities(data.responsibilities);
  const permissions = parsePermissions(data.permissions);

  return {
    firstName: requiredFirstName,
    middleName,
    lastName: requiredLastName,
    secondLastName,
    displayName: requiredDisplayName,
    role,
    congregationId: requiredCongregationId,
    isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
    phone: normalizeText(data.phone),
    gender,
    password: requiredPassword,
    servicePosition: primaryAssignment.position,
    serviceDepartment: primaryAssignment.department,
    departmentLabel: primaryAssignment.label,
    serviceAssignments,
    privileges,
    responsibilities,
    permissions,
  };
};

export const parseUpdateUserPayload = (raw: unknown): UpdateUserPayload => {
  if (typeof raw !== 'object' || raw === null) {
    throw new HttpsError('invalid-argument', 'Payload invalido.');
  }

  const root = raw as Record<string, unknown>;
  const uid = normalizeText(root.uid);

  if (!uid) {
    throw new HttpsError('invalid-argument', 'UID invalido.');
  }

  const nested =
    typeof root.data === 'object' && root.data !== null
      ? (root.data as Record<string, unknown>)
      : root;

  const legacyFirstName = normalizeText(root.firstName);
  const legacyLastName = normalizeText(root.lastName);
  const legacyDisplayName = [legacyFirstName, legacyLastName].filter(Boolean).join(' ').trim();
  const displayName = normalizeText(nested.displayName) ?? (legacyDisplayName || undefined);

  const roleCandidate = nested.role ?? root.role;
  const role = roleCandidate !== undefined ? roleCandidate : undefined;

  if (role !== undefined) {
    assertValidRole(role);
  }

  let isActive: boolean | undefined;

  if (typeof nested.isActive === 'boolean') {
    isActive = nested.isActive;
  } else if (nested.status === 'active') {
    isActive = true;
  } else if (nested.status === 'inactive' || nested.status === 'suspended') {
    isActive = false;
  } else if (typeof root.isActive === 'boolean') {
    isActive = root.isActive;
  }

  const phoneProvided = Object.prototype.hasOwnProperty.call(nested, 'phone');
  const genderProvided = Object.prototype.hasOwnProperty.call(nested, 'gender');
  const servicePositionProvided =
    Object.prototype.hasOwnProperty.call(nested, 'servicePosition') ||
    Object.prototype.hasOwnProperty.call(nested, 'department');
  const serviceDepartmentProvided =
    Object.prototype.hasOwnProperty.call(nested, 'serviceDepartment') ||
    Object.prototype.hasOwnProperty.call(nested, 'department');

  const legacyAssignment = parseLegacyAssignmentLabel(normalizeText(nested.department));
  const servicePosition = servicePositionProvided
    ? (parseServicePosition(nested.servicePosition) ?? legacyAssignment.position)
    : undefined;
  const serviceDepartment = serviceDepartmentProvided
    ? (parseServiceDepartment(nested.serviceDepartment) ?? legacyAssignment.department)
    : undefined;
  const privilegesProvided = Object.prototype.hasOwnProperty.call(nested, 'privileges');
  const serviceAssignmentsProvided = Object.prototype.hasOwnProperty.call(nested, 'serviceAssignments');
  const responsibilitiesProvided = Object.prototype.hasOwnProperty.call(nested, 'responsibilities');
  const permissionsProvided = Object.prototype.hasOwnProperty.call(nested, 'permissions');
  const legacyPrivilegesProvided =
    Object.prototype.hasOwnProperty.call(nested, 'isElder') ||
    Object.prototype.hasOwnProperty.call(nested, 'isMinisterialServant');
  const privileges = privilegesProvided || legacyPrivilegesProvided
    ? parsePrivilegesWithLegacyFlags(nested.privileges, nested)
    : undefined;
  const responsibilities = responsibilitiesProvided
    ? parseResponsibilities(nested.responsibilities)
    : undefined;
  const permissions = permissionsProvided ? parsePermissions(nested.permissions) : undefined;

  return {
    uid,
    displayName,
    role: role as Role | undefined,
    isActive,
    phone: normalizeText(nested.phone),
    phoneProvided,
    gender: genderProvided ? parseGender(nested.gender) : undefined,
    genderProvided,
    servicePosition,
    serviceDepartment,
    servicePositionProvided,
    serviceDepartmentProvided,
    serviceAssignmentProvided: servicePositionProvided || serviceDepartmentProvided,
    serviceAssignmentsRaw: nested.serviceAssignments,
    serviceAssignmentsProvided,
    privileges,
    responsibilities,
    permissions,
    privilegesProvided: privilegesProvided || legacyPrivilegesProvided,
    responsibilitiesProvided,
    permissionsProvided,
  };
};

export const parseUpdatePasswordPayload = (raw: unknown): UpdatePasswordPayload => {
  if (typeof raw !== 'object' || raw === null) {
    throw new HttpsError('invalid-argument', 'Payload invalido.');
  }

  const data = raw as Record<string, unknown>;
  const uid = normalizeText(data.uid);
  const newPassword = normalizeText(data.newPassword);

  if (!uid || !newPassword) {
    throw new HttpsError('invalid-argument', 'UID o contrasena invalida.');
  }

  if (newPassword.length < 6) {
    throw new HttpsError('invalid-argument', 'La contrasena debe tener al menos 6 caracteres.');
  }

  return { uid, newPassword };
};

export const parseUidFromPayload = (raw: unknown): string => {
  if (typeof raw !== 'object' || raw === null) {
    throw new HttpsError('invalid-argument', 'Payload invalido.');
  }

  const uid = normalizeText((raw as Record<string, unknown>).uid);
  if (!uid) {
    throw new HttpsError('invalid-argument', 'UID invalido.');
  }

  return uid;
};
