import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { isSystemPrincipalUser, SYSTEM_ACTOR_LABEL } from './user-protection.js';

type Role = 'admin' | 'supervisor' | 'user';
type Gender = 'masculino' | 'femenino';
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

type UserPrivileges = {
  isElder?: boolean;
  isMinisterialServant?: boolean;
  isRegularPioneer?: boolean;
  isAuxiliaryPioneer?: boolean;
};

type UserResponsibilities = {
  isPreachingManager?: boolean;
};

type PermissionDepartment =
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
  | 'organigrama';

type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'manage'
  | 'approve'
  | 'export';

type TerritoryPermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'assign' | 'manage';

type DepartmentPermissions = Partial<Record<PermissionAction, boolean>> & {
  territories?: Partial<Record<TerritoryPermissionAction, boolean>>;
  manageTerritories?: boolean;
};

type UserPermissions = Partial<Record<PermissionDepartment, DepartmentPermissions>>;

type ServiceAssignment = {
  position?: ServicePosition;
  department?: ServiceDepartment;
  label?: string;
};

type StoredServiceAssignment = {
  position: ServicePosition;
  department?: ServiceDepartment;
  label: string;
};

type RequesterProfile = {
  role: Role;
  isActive: boolean;
  congregationId: string;
  displayName?: string;
  email?: string;
  servicePosition?: ServicePosition;
  protectedFromDeletion?: boolean;
  isSystemUser?: boolean;
  isPrimaryAdmin?: boolean;
  isRootAdmin?: boolean;
  systemProtected?: boolean;
  permissions?: UserPermissions;
};

type ListUsersPayload = {
  activeOnly?: boolean;
};

type ListUsersResult = {
  users: (Record<string, unknown> & { uid: string })[];
};

type CreateUserPayload = {
  firstName: string;
  middleName?: string;
  lastName: string;
  secondLastName?: string;
  displayName: string;
  role: Role;
  congregationId: string;
  isActive: boolean;
  phone?: string;
  gender?: Gender;
  password: string;
  servicePosition?: ServicePosition;
  serviceDepartment?: ServiceDepartment;
  departmentLabel?: string;
  serviceAssignments: StoredServiceAssignment[];
  privileges?: UserPrivileges;
  responsibilities?: UserResponsibilities;
  permissions?: UserPermissions;
};

const logCreateUserFailure = (
  error: unknown,
  context: {
    step: string;
    requesterUid?: string;
    congregationId?: string;
    role?: Role;
    raw?: unknown;
  }
) => {
  const httpsError = error instanceof HttpsError ? error : undefined;
  const raw = typeof context.raw === 'object' && context.raw !== null
    ? context.raw as Record<string, unknown>
    : undefined;
  const rawPermissions = typeof raw?.permissions === 'object' && raw.permissions !== null && !Array.isArray(raw.permissions)
    ? raw.permissions as Record<string, unknown>
    : undefined;
  const rawAssignments = Array.isArray(raw?.serviceAssignments)
    ? raw.serviceAssignments.map((item) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        return { type: typeof item };
      }
      const assignment = item as Record<string, unknown>;
      return {
        position: assignment.position,
        department: assignment.department,
        keys: Object.keys(assignment),
      };
    })
    : undefined;

  logger.error('createUserByAdmin failed', {
    step: context.step,
    requesterUid: context.requesterUid,
    congregationId: context.congregationId,
    role: context.role,
    code: httpsError?.code,
    errorMessage: error instanceof Error ? error.message : String(error),
    payloadSummary: raw
      ? {
        keys: Object.keys(raw),
        role: raw.role,
        gender: raw.gender,
        servicePosition: raw.servicePosition,
        serviceDepartment: raw.serviceDepartment,
        serviceAssignments: rawAssignments,
        permissionDepartments: rawPermissions ? Object.keys(rawPermissions) : undefined,
      }
      : undefined,
  });
};

type UpdateUserPayload = {
  uid: string;
  displayName?: string;
  role?: Role;
  isActive?: boolean;
  phone?: string;
  phoneProvided: boolean;
  gender?: Gender;
  genderProvided: boolean;
  servicePosition?: ServicePosition;
  serviceDepartment?: ServiceDepartment;
  servicePositionProvided: boolean;
  serviceDepartmentProvided: boolean;
  serviceAssignmentProvided: boolean;
  serviceAssignmentsRaw?: unknown;
  serviceAssignmentsProvided: boolean;
  privileges?: UserPrivileges;
  responsibilities?: UserResponsibilities;
  permissions?: UserPermissions;
  privilegesProvided: boolean;
  responsibilitiesProvided: boolean;
  permissionsProvided: boolean;
};

type UpdatePasswordPayload = {
  uid: string;
  newPassword: string;
};

const SERVICE_DEPARTMENT_LABELS: Record<ServiceDepartment, string> = {
  limpieza: 'Limpieza',
  literatura: 'Literatura',
  tesoreria: 'Tesoreria',
  mantenimiento: 'Mantenimiento',
  discursos: 'Discursos',
  reuniones: 'Reuniones',
  predicacion: 'Predicacion',
  audio_video: 'Audio y Video',
  acomodadores_microfonos: 'Acomodadores y Microfonos',
};

const SERVICE_DEPARTMENT_LABEL_TO_KEY: Record<string, ServiceDepartment> = Object.fromEntries(
  Object.entries(SERVICE_DEPARTMENT_LABELS).map(([key, value]) => [value, key as ServiceDepartment])
) as Record<string, ServiceDepartment>;

type BillingPlanKey = 'omp_80' | 'omp_150' | 'omp_250';

const PLAN_LIMITS: Record<BillingPlanKey, number> = {
  omp_80: 80,
  omp_150: 150,
  omp_250: 250,
};

const USERS_QUERY_PAGE_SIZE = 200;

const PERMISSION_DEPARTMENTS: PermissionDepartment[] = [
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

const PERMISSION_ACTIONS: PermissionAction[] = [
  'view',
  'create',
  'edit',
  'delete',
  'manage',
  'approve',
  'export',
];

const TERRITORY_PERMISSION_ACTIONS: TerritoryPermissionAction[] = [
  'view',
  'create',
  'edit',
  'delete',
  'assign',
  'manage',
];

function assertValidRole(role: unknown): asserts role is Role {
  if (role !== 'admin' && role !== 'supervisor' && role !== 'user') {
    throw new HttpsError('invalid-argument', 'Rol invalido.');
  }
}

function normalizeRole(value: unknown): Role | undefined {
  if (value === 'admin' || value === 'supervisor' || value === 'user') return value;
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim().toLowerCase();
  if (normalized === 'administrador') return 'admin';
  if (normalized === 'usuario') return 'user';
  return undefined;
}

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const resolveActorName = (
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

const resolveActorEmail = (
  actor: Pick<RequesterProfile, 'email'> | null | undefined
): string => {
  const email = normalizeText(actor?.email);
  return email === 'tu_correo@gmail.com' ? SYSTEM_ACTOR_LABEL : (email ?? '');
};

const parseServicePosition = (value: unknown): ServicePosition | undefined => {
  const text = normalizeText(value);
  if (!text) return undefined;
  if (text === 'coordinador' || text === 'secretario' || text === 'encargado' || text === 'auxiliar') {
    return text;
  }
  throw new HttpsError('invalid-argument', 'Asignacion de servicio invalida.');
};

const parseGender = (value: unknown): Gender | undefined => {
  const text = normalizeText(value);
  if (!text) return undefined;
  if (text === 'masculino' || text === 'femenino') return text;
  throw new HttpsError('invalid-argument', 'Genero invalido.');
};

const parseServiceDepartment = (value: unknown): ServiceDepartment | undefined => {
  const text = normalizeText(value);
  if (!text) return undefined;

  if (
    text === 'limpieza' ||
    text === 'literatura' ||
    text === 'tesoreria' ||
    text === 'mantenimiento' ||
    text === 'discursos' ||
    text === 'reuniones' ||
    text === 'predicacion' ||
    text === 'audio_video' ||
    text === 'acomodadores_microfonos'
  ) {
    return text;
  }

  throw new HttpsError('invalid-argument', 'Departamento de servicio invalido.');
};

const parseBooleanMap = <TKeys extends string>(
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

const parsePrivileges = (value: unknown): UserPrivileges | undefined => {
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

const parsePrivilegesWithLegacyFlags = (
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

const parseResponsibilities = (value: unknown): UserResponsibilities | undefined =>
  parseBooleanMap(
    value,
    ['isPreachingManager'] as const,
    'Responsabilidades'
  ) as UserResponsibilities | undefined;

const parsePermissions = (
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

const parseLegacyAssignmentLabel = (
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

const buildServiceAssignmentLabel = (position?: ServicePosition, department?: ServiceDepartment): string | undefined => {
  if (!position) return undefined;
  if (position === 'coordinador') return 'Coordinador';
  if (position === 'secretario') return 'Secretario';

  if (!department) return undefined;
  const departmentLabel = SERVICE_DEPARTMENT_LABELS[department];
  if (position === 'encargado') return `Encargado de ${departmentLabel}`;
  if (position === 'auxiliar') return `Auxiliar de ${departmentLabel}`;

  return undefined;
};

const requiresAdminElderPosition = (position?: ServicePosition): boolean =>
  position === 'coordinador' || position === 'secretario';

const serviceAssignmentsRequireAdminElder = (
  assignments: Pick<StoredServiceAssignment, 'position'>[]
): boolean =>
  assignments.some((assignment) => requiresAdminElderPosition(assignment.position));

const rawServiceAssignmentsRequireAdminElder = (value: unknown): boolean => {
  if (!Array.isArray(value)) return false;

  return value.some((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return false;
    const position = parseServicePosition((item as Record<string, unknown>).position);
    return requiresAdminElderPosition(position);
  });
};

const ensureAdminElderPrivileges = (
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

const normalizeAssignmentForRole = (
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

const normalizeStoredAssignmentForRole = (
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

const parseServiceAssignments = (
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

const shouldValidateAssignmentUniqueness = (
  assignment: ServiceAssignment,
  isActive: boolean
): boolean => {
  if (!isActive) return false;
  return (
    assignment.position === 'coordinador' ||
    assignment.position === 'secretario' ||
    (assignment.position === 'encargado' && Boolean(assignment.department))
  );
};

const listCongregationUserDocs = async (params: {
  congregationId: string;
  activeOnly?: boolean;
}): Promise<QueryDocumentSnapshot[]> => {
  const db = getFirestore();
  const docs: QueryDocumentSnapshot[] = [];
  let lastDoc: QueryDocumentSnapshot | undefined;

  while (true) {
    let query = db
      .collection('users')
      .where('congregationId', '==', params.congregationId)
      .orderBy('__name__')
      .limit(USERS_QUERY_PAGE_SIZE);

    if (params.activeOnly) {
      query = db
        .collection('users')
        .where('congregationId', '==', params.congregationId)
        .where('isActive', '==', true)
        .orderBy('__name__')
        .limit(USERS_QUERY_PAGE_SIZE);
    }

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snap = await query.get();
    docs.push(...snap.docs);

    if (snap.size < USERS_QUERY_PAGE_SIZE) {
      break;
    }

    lastDoc = snap.docs[snap.docs.length - 1];
  }

  return docs;
};

const assertAssignmentUniqueness = async (params: {
  congregationId: string;
  assignments: ServiceAssignment[];
  excludeUid?: string;
  isActive: boolean;
}): Promise<void> => {
  const { congregationId, assignments, excludeUid, isActive } = params;
  const targetAssignments = assignments.filter((assignment) =>
    shouldValidateAssignmentUniqueness(assignment, isActive)
  );
  if (targetAssignments.length === 0) {
    return;
  }

  const docs = await listCongregationUserDocs({
    congregationId,
    activeOnly: true,
  });

  for (const assignment of targetAssignments) {
    const owner = docs.find((doc) => {
      if (doc.id === excludeUid) return false;
      const data = doc.data() as Record<string, unknown>;
      const legacy = parseLegacyAssignmentLabel(normalizeText(data.department));
      const currentAssignments = parseServiceAssignments(
        data.serviceAssignments,
        (data.role === 'admin' || data.role === 'supervisor' || data.role === 'user') ? data.role : 'user',
        {
          position: parseServicePosition(data.servicePosition) ?? legacy.position,
          department: parseServiceDepartment(data.serviceDepartment) ?? legacy.department,
        }
      );
      return currentAssignments.some((current) => {
        if (assignment.position === 'coordinador' || assignment.position === 'secretario') {
          return current.position === assignment.position;
        }

        return (
          assignment.position === 'encargado' &&
          current.position === 'encargado' &&
          current.department === assignment.department
        );
      });
    });

    if (!owner) continue;

    if (assignment.position === 'coordinador') {
      throw new HttpsError('already-exists', 'Ya existe un Coordinador activo en esta congregacion.');
    }

    if (assignment.position === 'secretario') {
      throw new HttpsError('already-exists', 'Ya existe un Secretario activo en esta congregacion.');
    }

    if (assignment.position === 'encargado' && assignment.department) {
      const label = buildServiceAssignmentLabel('encargado', assignment.department);
      throw new HttpsError('already-exists', `Ya existe un ${label} activo en esta congregacion.`);
    }

    throw new HttpsError('already-exists', 'Esta funcion congregacional ya esta ocupada.');
  }
};

const normalizeDomainCandidate = (value: unknown): string | undefined => {
  const source = normalizeText(value);
  if (!source) return undefined;

  let normalized = source
    .toLowerCase()
    .replace(/^mailto:/, '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

  if (normalized.includes('@')) {
    normalized = normalized.split('@').pop() ?? normalized;
  }

  normalized = normalized.split('/')[0].trim();

  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)) {
    return undefined;
  }

  return normalized;
};

const slugifyDomainLabel = (value: unknown): string => {
  const source = normalizeText(value) ?? 'congregacion';

  const normalized = source
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized.length > 0 ? normalized : 'congregacion';
};

const resolveCongregationEmailDomain = (
  congregationId: string,
  congregationData?: Record<string, unknown>
): string => {
  const explicitDomain =
    normalizeDomainCandidate(congregationData?.emailDomain) ??
    normalizeDomainCandidate(congregationData?.domain);

  if (explicitDomain) {
    return explicitDomain;
  }

  const directFromId = normalizeDomainCandidate(congregationId);
  if (directFromId) {
    return directFromId;
  }

  const labelSource =
    normalizeText(congregationData?.slug) ??
    normalizeText(congregationData?.name) ??
    normalizeText(congregationData?.displayName) ??
    congregationId;

  return `${slugifyDomainLabel(labelSource)}.com`;
};

const normalizeNameForEmail = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

const buildEmailLocalPart = (...values: (string | undefined)[]): string => {
  return values
    .map((value) => (value ? normalizeNameForEmail(value) : ''))
    .filter(Boolean)
    .join('');
};

const buildEmailLocalCandidates = (
  firstName: string,
  middleName: string | undefined,
  lastName: string
): string[] => {
  const primary = buildEmailLocalPart(firstName, lastName);
  const withMiddle = middleName ? buildEmailLocalPart(firstName, middleName, lastName) : '';

  const candidates = [primary, withMiddle].filter(Boolean);
  return Array.from(new Set(candidates));
};

const isAuthUserNotFoundError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const code = 'code' in error ? String(error.code) : '';
  return code === 'auth/user-not-found';
};

const isEmailTaken = async (email: string): Promise<boolean> => {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    await getAuth().getUserByEmail(normalizedEmail);
    return true;
  } catch (error) {
    if (!isAuthUserNotFoundError(error)) {
      throw error;
    }
  }

  const db = getFirestore();
  const [emailSnap, emailKeySnap] = await Promise.all([
    db.collection('users').where('email', '==', normalizedEmail).limit(1).get(),
    db.collection('users').where('emailKey', '==', normalizedEmail).limit(1).get(),
  ]);
  return !emailSnap.empty || !emailKeySnap.empty;
};

const resolveGeneratedEmail = async (
  firstName: string,
  middleName: string | undefined,
  lastName: string,
  requiredDomain: string
): Promise<string> => {
  const normalizedDomain = requiredDomain.toLowerCase();
  const candidates = buildEmailLocalCandidates(firstName, middleName, lastName);
  const fallbackBase = candidates[0] || 'usuario';

  for (const localPart of candidates) {
    const email = `${localPart}@${normalizedDomain}`;
    if (!(await isEmailTaken(email))) {
      return email;
    }
  }

  for (let suffix = 2; suffix < 500; suffix += 1) {
    const email = `${fallbackBase}${suffix}@${normalizedDomain}`;
    if (!(await isEmailTaken(email))) {
      return email;
    }
  }

  throw new HttpsError(
    'resource-exhausted',
    'No se pudo generar un correo disponible para este usuario.'
  );
};

const splitDisplayName = (displayName: string): { firstName?: string; lastName?: string } => {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return {};
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ') || undefined,
  };
};

export const listUsersForCurrentCongregation = onCall(
  { region: 'us-central1' },
  async (request): Promise<ListUsersResult> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const requester = await getRequesterProfile(request.auth.uid);
    assertCanListUsers(requester);

    const payload = parseListUsersPayload(request.data);
    const docs = await listCongregationUserDocs({
      congregationId: requester.congregationId,
      activeOnly: payload.activeOnly,
    });
    const users = sortListedUsers(
      docs
        .map((doc) => sanitizeUserForList(doc.id, doc.data()))
        .filter((user) => !payload.activeOnly || isActiveUserListRecord(user))
    );

    return { users };
  }
);

export const listOrgChartUsersForCurrentCongregation = onCall(
  { region: 'us-central1' },
  async (request): Promise<ListUsersResult> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const requester = await getRequesterProfile(request.auth.uid);
    const docs = await listCongregationUserDocs({
      congregationId: requester.congregationId,
      activeOnly: true,
    });
    const users = sortListedUsers(
      docs
        .map((doc) => sanitizeOrgChartUserForList(doc.id, doc.data()))
        .filter(isActiveUserListRecord)
    );

    return { users };
  }
);

async function getRequesterProfile(uid: string): Promise<RequesterProfile> {
  const db = getFirestore();
  const snap = await db.collection('users').doc(uid).get();

  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'No existe perfil del usuario autenticado.');
  }

  const data = snap.data();
  if (!data?.isActive) {
    throw new HttpsError('permission-denied', 'El usuario autenticado esta inactivo.');
  }

  const role = normalizeRole(data.role);
  if (!role) {
    throw new HttpsError('permission-denied', 'Rol de usuario invalido.');
  }

  return {
    ...(data as RequesterProfile),
    role,
    permissions: parsePermissions(data.permissions, { strict: false }),
  };
}

const billingTimestampToMillis = (value: unknown): number | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { toMillis?: unknown };
  if (typeof candidate.toMillis !== 'function') return null;
  const millis = candidate.toMillis() as number;
  return Number.isFinite(millis) ? millis : null;
};

const isBillingExemptionActive = (data: Record<string, unknown>): boolean => {
  const exemption = data.billingExemption;
  if (typeof exemption !== 'object' || exemption === null || Array.isArray(exemption)) {
    return false;
  }

  const source = exemption as Record<string, unknown>;
  if (source.exempt !== true) return false;

  const expiresAt = billingTimestampToMillis(source.expiresAt);
  return expiresAt === null || expiresAt > Date.now();
};

const assertAdministrativeBillingAccess = async (
  congregationId: string
): Promise<void> => {
  const snap = await getFirestore().collection('congregations').doc(congregationId).get();
  if (!snap.exists) return;

  const data = snap.data() as Record<string, unknown>;
  if (isBillingExemptionActive(data)) return;

  const billing = data.billing;
  if (typeof billing !== 'object' || billing === null || Array.isArray(billing)) {
    return;
  }

  const source = billing as Record<string, unknown>;
  const status = typeof source.status === 'string' ? source.status : '';
  const graceUntil = billingTimestampToMillis(source.graceUntil);
  const restricted =
    source.provider === 'stripe' &&
    (
      source.adminRestricted === true ||
      status === 'unpaid' ||
      status === 'canceled' ||
      status === 'incomplete_expired' ||
      (
        (status === 'past_due' || status === 'payment_action_required' || status === 'incomplete') &&
        graceUntil !== null &&
        graceUntil <= Date.now()
      )
    );

  if (restricted) {
    throw new HttpsError(
      'failed-precondition',
      'La facturacion de la congregacion requiere atencion antes de realizar cambios administrativos.'
    );
  }
};

const requesterHasPermission = (
  profile: Pick<RequesterProfile, 'role' | 'permissions'>,
  department: PermissionDepartment,
  action: PermissionAction
): boolean =>
  profile.role === 'admin' ||
  profile.permissions?.[department]?.[action] === true ||
  profile.permissions?.[department]?.manage === true;

function assertUserPermission(
  profile: RequesterProfile,
  action: PermissionAction
) {
  if (!requesterHasPermission(profile, 'usuarios', action)) {
    throw new HttpsError('permission-denied', 'No tienes permisos para gestionar usuarios.');
  }
}

const requesterHasGlobalScreenAccess = (profile: RequesterProfile): boolean =>
  profile.role === 'admin' ||
  profile.servicePosition === 'coordinador' ||
  profile.servicePosition === 'secretario' ||
  profile.protectedFromDeletion === true ||
  profile.isSystemUser === true ||
  profile.isPrimaryAdmin === true ||
  profile.isRootAdmin === true ||
  profile.systemProtected === true;

function assertCanListUsers(profile: RequesterProfile) {
  const canList =
    profile.role === 'admin' ||
    profile.role === 'supervisor' ||
    requesterHasGlobalScreenAccess(profile) ||
    profile.permissions?.departments?.manage === true ||
    requesterHasPermission(profile, 'usuarios', 'view') ||
    requesterHasPermission(profile, 'usuarios', 'manage');

  if (!canList) {
    throw new HttpsError('permission-denied', 'No tienes permisos para ver usuarios.');
  }
}

const sanitizeUserForList = (
  uid: string,
  data: Record<string, unknown>
): Record<string, unknown> & { uid: string } => {
  const allowedKeys = [
    'email',
    'displayName',
    'role',
    'congregationId',
    'isActive',
    'active',
    'status',
    'phone',
    'gender',
    'department',
    'servicePosition',
    'serviceDepartment',
    'serviceAssignments',
    'privileges',
    'responsibilities',
    'permissions',
    'isElder',
    'isMinisterialServant',
    'avatarUrl',
    'secondLastName',
    'cleaningEligible',
    'cleaningGroupId',
    'cleaningGroupName',
    'notificationsEnabled',
    'platformNotifications',
    'cleaningNotifications',
    'hospitalityNotifications',
    'createdBy',
    'createdByName',
    'createdByEmail',
    'updatedBy',
    'updatedByName',
    'updatedByEmail',
    'protectedFromDeletion',
    'isSystemUser',
    'isPrimaryAdmin',
    'isRootAdmin',
    'systemProtected',
    'createdAt',
    'updatedAt',
  ] as const;

  return allowedKeys.reduce<Record<string, unknown> & { uid: string }>(
    (acc, key) => {
      if (data[key] !== undefined) {
        acc[key] = data[key];
      }
      return acc;
    },
    { uid }
  );
};

const sanitizeOrgChartUserForList = (
  uid: string,
  data: Record<string, unknown>
): Record<string, unknown> & { uid: string } => {
  const allowedKeys = [
    'displayName',
    'congregationId',
    'isActive',
    'active',
    'status',
    'department',
    'servicePosition',
    'serviceDepartment',
    'serviceAssignments',
  ] as const;

  return allowedKeys.reduce<Record<string, unknown> & { uid: string }>(
    (acc, key) => {
      if (data[key] !== undefined) {
        acc[key] = data[key];
      }
      return acc;
    },
    { uid }
  );
};

const isActiveUserListRecord = (data: Record<string, unknown>): boolean => {
  if (typeof data.isActive === 'boolean') return data.isActive;
  if (typeof data.active === 'boolean') return data.active;
  if (data.status === 'inactive' || data.status === 'suspended') return false;
  return true;
};

const sortListedUsers = (
  users: (Record<string, unknown> & { uid: string })[]
): (Record<string, unknown> & { uid: string })[] =>
  [...users].sort((left, right) => {
    const leftLabel = normalizeText(left.displayName) ?? normalizeText(left.email) ?? left.uid;
    const rightLabel = normalizeText(right.displayName) ?? normalizeText(right.email) ?? right.uid;
    return leftLabel.localeCompare(rightLabel, 'es');
  });

const parseListUsersPayload = (value: unknown): ListUsersPayload => {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', 'Solicitud invalida.');
  }

  const source = value as Record<string, unknown>;
  return {
    activeOnly: source.activeOnly === true,
  };
};

const assertDelegatedCreateIsSafe = (requester: RequesterProfile, payload: CreateUserPayload) => {
  if (requester.role === 'admin') return;

  if (
    payload.role !== 'user' ||
    (payload.privileges && Object.keys(payload.privileges).length > 0) ||
    (payload.responsibilities && Object.keys(payload.responsibilities).length > 0) ||
    (payload.permissions && Object.keys(payload.permissions).length > 0) ||
    payload.serviceAssignments.length > 0
  ) {
    throw new HttpsError(
      'permission-denied',
      'Los permisos delegados no permiten asignar rol, privilegios ni funciones.'
    );
  }
};

const assertDelegatedUpdateIsSafe = (
  requester: RequesterProfile,
  payload: UpdateUserPayload
) => {
  if (requester.role === 'admin') return;

  if (
    payload.role ||
    payload.privilegesProvided ||
    payload.responsibilitiesProvided ||
    payload.permissionsProvided ||
    payload.serviceAssignmentsProvided ||
    payload.serviceAssignmentProvided
  ) {
    throw new HttpsError(
      'permission-denied',
      'Los permisos delegados no permiten cambiar rol, permisos, privilegios ni funciones.'
    );
  }
};

const parseCreateUserPayload = (raw: unknown): CreateUserPayload => {
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

const parseUpdateUserPayload = (raw: unknown): UpdateUserPayload => {
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

const parseUpdatePasswordPayload = (raw: unknown): UpdatePasswordPayload => {
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

const parseUidFromPayload = (raw: unknown): string => {
  if (typeof raw !== 'object' || raw === null) {
    throw new HttpsError('invalid-argument', 'Payload invalido.');
  }

  const uid = normalizeText((raw as Record<string, unknown>).uid);
  if (!uid) {
    throw new HttpsError('invalid-argument', 'UID invalido.');
  }

  return uid;
};

const isBillingPlanKey = (value: unknown): value is BillingPlanKey =>
  value === 'omp_80' || value === 'omp_150' || value === 'omp_250';

const normalizePlanKey = (value: unknown): BillingPlanKey => {
  if (isBillingPlanKey(value)) return value;
  if (value === 'complete') return 'omp_250';
  if (value === 'intermediate') return 'omp_150';
  if (value === 'basic') return 'omp_80';
  return 'omp_80';
};

const normalizePlanLimit = (value: unknown, fallbackPlanKey: BillingPlanKey): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return PLAN_LIMITS[fallbackPlanKey];
  }

  const normalized = Math.max(0, Math.floor(value));
  if (normalized === 70) return PLAN_LIMITS.omp_80;
  if (normalized === 80) return PLAN_LIMITS.omp_80;
  if (normalized === 120) return PLAN_LIMITS.omp_150;
  if (normalized === 150) return PLAN_LIMITS.omp_150;
  if (normalized === 200) return PLAN_LIMITS.omp_250;
  if (normalized === 250) return PLAN_LIMITS.omp_250;
  return normalized;
};

const asPlainRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const resolvePlanKeyFromData = (
  congregationData: Record<string, unknown>,
  privatePlan: Record<string, unknown>
): BillingPlanKey => {
  const billing = asPlainRecord(congregationData.billing);
  return normalizePlanKey(
    billing?.planKey ??
      congregationData.planKey ??
      privatePlan.planKey ??
      privatePlan.planId
  );
};

const resolveCongregationActiveUsersLimit = async (congregationId: string): Promise<number> => {
  const db = getFirestore();
  const congregationRef = db.collection('congregations').doc(congregationId);
  const [congregationSnap, privatePlanSnap] = await Promise.all([
    congregationRef.get(),
    congregationRef.collection('private').doc('plan').get(),
  ]);
  const congregationData = congregationSnap.exists
    ? congregationSnap.data() as Record<string, unknown>
    : {};
  const privatePlan = privatePlanSnap.exists ? privatePlanSnap.data() as Record<string, unknown> : {};
  const billing = asPlainRecord(congregationData.billing);
  const planKey = resolvePlanKeyFromData(congregationData, privatePlan);

  return normalizePlanLimit(
    billing?.activeUsersLimit ??
      billing?.userLimit ??
      congregationData.activeUsersLimit ??
      congregationData.userLimit ??
      privatePlan.activeUsersLimit ??
      privatePlan.userLimit,
    planKey
  );
};

const assertCongregationHasUserCapacity = async (params: {
  congregationId: string;
  willCreateActiveUser: boolean;
}) => {
  if (!params.willCreateActiveUser) return;

  const db = getFirestore();
  const limitValue = await resolveCongregationActiveUsersLimit(params.congregationId);
  const activeUsersSnap = await db
    .collection('users')
    .where('congregationId', '==', params.congregationId)
    .where('isActive', '==', true)
    .limit(Math.max(limitValue + 1, 1))
    .get();

  if (activeUsersSnap.size >= limitValue) {
    throw new HttpsError(
      'resource-exhausted',
      `La congregacion alcanzo el limite de usuarios activos de su plan (${limitValue}).`
    );
  }
};

export const createUserByAdmin = onCall(
  { region: 'us-central1' },
  async (request) => {
    let step = 'auth';
    let payload: CreateUserPayload | undefined;

    try {
      if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
      }

      step = 'requester-profile';
      const requester = await getRequesterProfile(request.auth.uid);
      await assertAdministrativeBillingAccess(requester.congregationId);

      step = 'requester-permission';
      assertUserPermission(requester, 'create');

      step = 'payload';
      payload = parseCreateUserPayload(request.data);

      step = 'delegated-safety';
      assertDelegatedCreateIsSafe(requester, payload);

      step = 'same-congregation';
      if (payload.congregationId !== requester.congregationId) {
        throw new HttpsError('permission-denied', 'No puedes crear usuarios en otra congregacion.');
      }

      step = 'assignment-uniqueness';
      await assertAssignmentUniqueness({
        congregationId: payload.congregationId,
        assignments: payload.serviceAssignments,
        isActive: payload.isActive,
      });

      step = 'plan-capacity';
      await assertCongregationHasUserCapacity({
        congregationId: payload.congregationId,
        willCreateActiveUser: payload.isActive,
      });

      const auth = getAuth();
      const db = getFirestore();

      step = 'congregation-domain';
      const congregationSnap = await db.collection('congregations').doc(payload.congregationId).get();
      const congregationData = congregationSnap.exists ? (congregationSnap.data() as Record<string, unknown>) : undefined;

      const requiredDomain = resolveCongregationEmailDomain(payload.congregationId, congregationData);
      const generatedEmail = await resolveGeneratedEmail(
        payload.firstName,
        payload.middleName,
        payload.lastName,
        requiredDomain
      );

      step = 'auth-create';
      const userRecord = await auth.createUser({
        email: generatedEmail,
        password: payload.password,
        displayName: payload.displayName,
        disabled: !payload.isActive,
      });

      try {
        step = 'firestore-profile';
        const userDoc: Record<string, unknown> = {
          uid: userRecord.uid,
          email: generatedEmail,
          emailKey: generatedEmail.trim().toLowerCase(),
          displayName: payload.displayName,
          role: payload.role,
          isActive: payload.isActive,
          status: payload.isActive ? 'active' : 'inactive',
          congregationId: payload.congregationId,
          congregationDomain: requiredDomain,
          createdBy: request.auth.uid,
          createdByName: resolveActorName(requester, request.auth.uid),
          createdByEmail: resolveActorEmail(requester),
          updatedBy: request.auth.uid,
          updatedByName: resolveActorName(requester, request.auth.uid),
          updatedByEmail: resolveActorEmail(requester),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };

        userDoc.firstName = payload.firstName;
        userDoc.lastName = payload.lastName;
        if (payload.middleName) userDoc.middleName = payload.middleName;
        if (payload.secondLastName) userDoc.secondLastName = payload.secondLastName;
        if (payload.phone) userDoc.phone = payload.phone;
        if (payload.gender) userDoc.gender = payload.gender;
        if (payload.servicePosition) userDoc.servicePosition = payload.servicePosition;
        if (payload.serviceDepartment) userDoc.serviceDepartment = payload.serviceDepartment;
        if (payload.departmentLabel) userDoc.department = payload.departmentLabel;
        userDoc.serviceAssignments = payload.serviceAssignments;
        if (payload.privileges && Object.keys(payload.privileges).length > 0) {
          userDoc.privileges = payload.privileges;
        }
        userDoc.isElder = payload.privileges?.isElder === true;
        userDoc.isMinisterialServant = payload.privileges?.isMinisterialServant === true;
        if (payload.responsibilities && Object.keys(payload.responsibilities).length > 0) {
          userDoc.responsibilities = payload.responsibilities;
        }
        if (payload.permissions && Object.keys(payload.permissions).length > 0) {
          userDoc.permissions = payload.permissions;
        }

        await db.collection('users').doc(userRecord.uid).set(userDoc);

        return {
          uid: userRecord.uid,
          email: generatedEmail,
          requiredDomain,
        };
      } catch (error) {
        await auth.deleteUser(userRecord.uid);
        throw error;
      }
    } catch (error) {
      logCreateUserFailure(error, {
        step,
        requesterUid: request.auth?.uid,
        congregationId: payload?.congregationId,
        role: payload?.role,
        raw: request.data,
      });
      throw error;
    }
  }
);

export const updateUserByAdmin = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const requester = await getRequesterProfile(request.auth.uid);
    await assertAdministrativeBillingAccess(requester.congregationId);
    assertUserPermission(requester, 'edit');

    const payload = parseUpdateUserPayload(request.data);
    assertDelegatedUpdateIsSafe(requester, payload);

    const db = getFirestore();
    const targetRef = db.collection('users').doc(payload.uid);
    const targetSnap = await targetRef.get();

    if (!targetSnap.exists) {
      throw new HttpsError('not-found', 'Usuario no encontrado.');
    }

    const target = targetSnap.data() as {
      congregationId: string;
      role?: Role;
      isActive?: boolean;
      servicePosition?: ServicePosition;
      serviceDepartment?: ServiceDepartment;
      department?: string;
      serviceAssignments?: StoredServiceAssignment[];
      privileges?: UserPrivileges;
      isElder?: boolean;
      isMinisterialServant?: boolean;
    };

    if (target.congregationId !== requester.congregationId) {
      throw new HttpsError('permission-denied', 'No puedes modificar usuarios de otra congregacion.');
    }

    if (target.role === 'admin' && requester.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Solo un administrador puede modificar a otro administrador.');
    }

    const currentRole = target.role === 'admin' || target.role === 'supervisor' || target.role === 'user'
      ? target.role
      : 'user';
    const requestedRole = payload.role ?? currentRole;
    const currentIsActive = Boolean(target.isActive);
    const nextIsActive = typeof payload.isActive === 'boolean' ? payload.isActive : currentIsActive;

    const legacyCurrentAssignment = parseLegacyAssignmentLabel(normalizeText(target.department));
    const currentPosition = target.servicePosition ?? legacyCurrentAssignment.position;
    const currentDepartment = target.serviceDepartment ?? legacyCurrentAssignment.department;

    let nextPosition = currentPosition;
    let nextDepartment = currentDepartment;

    if (payload.servicePositionProvided) {
      nextPosition = payload.servicePosition;
      if (!nextPosition) {
        nextDepartment = undefined;
      }
    }

    if (payload.serviceDepartmentProvided) {
      nextDepartment = payload.serviceDepartment;
    }

    const requestedAssignmentsRequireAdminElder = payload.serviceAssignmentsProvided
      ? rawServiceAssignmentsRequireAdminElder(payload.serviceAssignmentsRaw)
      : requiresAdminElderPosition(nextPosition);
    const nextRole: Role = requestedAssignmentsRequireAdminElder ? 'admin' : requestedRole;
    const normalizedAssignment = normalizeAssignmentForRole(nextRole, nextPosition, nextDepartment);
    const nextServiceAssignments = payload.serviceAssignmentsProvided
      ? parseServiceAssignments(payload.serviceAssignmentsRaw, nextRole)
      : parseServiceAssignments(target.serviceAssignments, nextRole, normalizedAssignment);
    const primaryAssignment = nextServiceAssignments[0];
    const finalRole: Role = serviceAssignmentsRequireAdminElder(nextServiceAssignments)
      ? 'admin'
      : nextRole;
    const currentPrivileges = parsePrivilegesWithLegacyFlags(target.privileges, target as Record<string, unknown>);
    const nextPrivileges = ensureAdminElderPrivileges(
      payload.privilegesProvided ? payload.privileges : currentPrivileges,
      serviceAssignmentsRequireAdminElder(nextServiceAssignments)
    );

    await assertAssignmentUniqueness({
      congregationId: target.congregationId,
      assignments: nextServiceAssignments,
      excludeUid: payload.uid,
      isActive: nextIsActive,
    });

    const authUpdates: { displayName?: string; disabled?: boolean } = {};

    if (payload.displayName) {
      authUpdates.displayName = payload.displayName;
    }

    if (typeof payload.isActive === 'boolean') {
      authUpdates.disabled = !payload.isActive;
    }

    if (Object.keys(authUpdates).length > 0) {
      await getAuth().updateUser(payload.uid, authUpdates);
    }

    const docUpdates: Record<string, unknown> = {
      updatedBy: request.auth.uid,
      updatedByName: resolveActorName(requester, request.auth.uid),
      updatedByEmail: resolveActorEmail(requester),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (payload.displayName) {
      const names = splitDisplayName(payload.displayName);
      docUpdates.displayName = payload.displayName;

      if (names.firstName) {
        docUpdates.firstName = names.firstName;
      } else {
        docUpdates.firstName = FieldValue.delete();
      }

      if (names.lastName) {
        docUpdates.lastName = names.lastName;
      } else {
        docUpdates.lastName = FieldValue.delete();
      }
    }

    if (payload.role || finalRole !== currentRole) {
      docUpdates.role = finalRole;
    }

    if (typeof payload.isActive === 'boolean') {
      docUpdates.isActive = payload.isActive;
      docUpdates.status = payload.isActive ? 'active' : 'inactive';
    }

    if (payload.phoneProvided) {
      docUpdates.phone = payload.phone ?? FieldValue.delete();
    }

    if (payload.genderProvided && payload.gender) {
      docUpdates.gender = payload.gender;
    }

    if (payload.serviceAssignmentsProvided || payload.serviceAssignmentProvided || payload.role) {
      if (primaryAssignment?.position) {
        docUpdates.servicePosition = primaryAssignment.position;
      } else {
        docUpdates.servicePosition = FieldValue.delete();
      }

      if (primaryAssignment?.department) {
        docUpdates.serviceDepartment = primaryAssignment.department;
      } else {
        docUpdates.serviceDepartment = FieldValue.delete();
      }

      if (primaryAssignment?.label) {
        docUpdates.department = primaryAssignment.label;
      } else {
        docUpdates.department = FieldValue.delete();
      }
    }

    if (payload.serviceAssignmentsProvided || payload.serviceAssignmentProvided || payload.role) {
      docUpdates.serviceAssignments =
        nextServiceAssignments.length > 0 ? nextServiceAssignments : FieldValue.delete();
    }

    if (payload.privilegesProvided || serviceAssignmentsRequireAdminElder(nextServiceAssignments)) {
      docUpdates.privileges =
        nextPrivileges && Object.keys(nextPrivileges).length > 0
          ? nextPrivileges
          : FieldValue.delete();
      docUpdates.isElder = nextPrivileges?.isElder === true;
      docUpdates.isMinisterialServant = nextPrivileges?.isMinisterialServant === true;
    }

    if (payload.responsibilitiesProvided) {
      docUpdates.responsibilities =
        payload.responsibilities && Object.keys(payload.responsibilities).length > 0
          ? payload.responsibilities
          : FieldValue.delete();
    }

    if (payload.permissionsProvided) {
      docUpdates.permissions =
        payload.permissions && Object.keys(payload.permissions).length > 0
          ? payload.permissions
          : FieldValue.delete();
    }

    await targetRef.update(docUpdates);

    const updatedSnap = await targetRef.get();
    const updatedData = updatedSnap.data() as {
      role?: Role;
      servicePosition?: ServicePosition;
      serviceDepartment?: ServiceDepartment;
      serviceAssignments?: StoredServiceAssignment[];
      privileges?: UserPrivileges;
      isElder?: boolean;
      isMinisterialServant?: boolean;
    } | undefined;

    logger.info('updateUserByAdmin persisted user fields', {
      requesterUid: request.auth.uid,
      targetUid: payload.uid,
      updatedKeys: Object.keys(docUpdates),
      persisted: {
        role: updatedData?.role,
        servicePosition: updatedData?.servicePosition,
        serviceDepartment: updatedData?.serviceDepartment,
        serviceAssignmentsCount: Array.isArray(updatedData?.serviceAssignments)
          ? updatedData.serviceAssignments.length
          : 0,
        privileges: updatedData?.privileges,
        isElder: updatedData?.isElder,
        isMinisterialServant: updatedData?.isMinisterialServant,
      },
    });

    return {
      ok: true,
      user: {
        uid: payload.uid,
        role: updatedData?.role,
        servicePosition: updatedData?.servicePosition,
        serviceDepartment: updatedData?.serviceDepartment,
        serviceAssignments: updatedData?.serviceAssignments ?? [],
        privileges: updatedData?.privileges ?? {},
        isElder: updatedData?.isElder === true,
        isMinisterialServant: updatedData?.isMinisterialServant === true,
      },
    };
  }
);

export const updateUserPasswordByAdmin = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const requester = await getRequesterProfile(request.auth.uid);
    await assertAdministrativeBillingAccess(requester.congregationId);
    assertUserPermission(requester, 'edit');

    const payload = parseUpdatePasswordPayload(request.data);

    if (payload.uid === request.auth.uid) {
      throw new HttpsError('failed-precondition', 'No puedes cambiar tu propia contrasena desde este flujo.');
    }

    const db = getFirestore();
    const targetRef = db.collection('users').doc(payload.uid);
    const targetSnap = await targetRef.get();

    if (!targetSnap.exists) {
      throw new HttpsError('not-found', 'Usuario no encontrado.');
    }

    const target = targetSnap.data() as { congregationId: string; role?: Role };
    if (target.congregationId !== requester.congregationId) {
      throw new HttpsError('permission-denied', 'No puedes modificar usuarios de otra congregacion.');
    }

    if (target.role === 'admin' && requester.role !== 'admin') {
      throw new HttpsError(
        'permission-denied',
        'Solo un administrador puede cambiar la contrasena de otro administrador.'
      );
    }

    await getAuth().updateUser(payload.uid, { password: payload.newPassword });
    await targetRef.update({
      updatedBy: request.auth.uid,
      updatedByName: resolveActorName(requester, request.auth.uid),
      updatedByEmail: resolveActorEmail(requester),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true };
  }
);

export const disableUserByAdmin = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const requester = await getRequesterProfile(request.auth.uid);
    await assertAdministrativeBillingAccess(requester.congregationId);
    assertUserPermission(requester, 'edit');

    const uid = parseUidFromPayload(request.data ?? {});

    if (uid === request.auth.uid) {
      throw new HttpsError('failed-precondition', 'No puedes desactivar tu propio usuario.');
    }

    const db = getFirestore();
    const targetRef = db.collection('users').doc(uid);
    const targetSnap = await targetRef.get();

    if (!targetSnap.exists) {
      throw new HttpsError('not-found', 'Usuario no encontrado.');
    }

    const target = targetSnap.data() as { congregationId: string; role?: Role };

    if (target.congregationId !== requester.congregationId) {
      throw new HttpsError('permission-denied', 'No puedes desactivar usuarios de otra congregacion.');
    }

    if (target.role === 'admin' && requester.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Solo un administrador puede desactivar a otro administrador.');
    }

    await getAuth().updateUser(uid, { disabled: true });
    await targetRef.update({
      isActive: false,
      status: 'inactive',
      updatedBy: request.auth.uid,
      updatedByName: resolveActorName(requester, request.auth.uid),
      updatedByEmail: resolveActorEmail(requester),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true };
  }
);

export const deleteUserByAdmin = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const requester = await getRequesterProfile(request.auth.uid);
    await assertAdministrativeBillingAccess(requester.congregationId);
    assertUserPermission(requester, 'delete');

    const uid = parseUidFromPayload(request.data ?? {});

    if (uid === request.auth.uid) {
      throw new HttpsError('failed-precondition', 'No puedes eliminar tu propio usuario.');
    }

    const db = getFirestore();
    const targetRef = db.collection('users').doc(uid);
    const targetSnap = await targetRef.get();

    if (!targetSnap.exists) {
      throw new HttpsError('not-found', 'Usuario no encontrado.');
    }

    const target = targetSnap.data() as { congregationId: string; role?: Role };

    if (target.congregationId !== requester.congregationId) {
      throw new HttpsError('permission-denied', 'No puedes eliminar usuarios de otra congregacion.');
    }

    if (target.role === 'admin' && requester.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Solo un administrador puede eliminar a otro administrador.');
    }

    if (isSystemPrincipalUser(target as Record<string, unknown>)) {
      throw new HttpsError(
        'failed-precondition',
        'Este usuario fue creado por el sistema principal y no se puede eliminar.'
      );
    }

    await getAuth().deleteUser(uid);
    await targetRef.delete();

    return { ok: true };
  }
);
