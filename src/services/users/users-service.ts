import {
  deleteDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';

import {
  logFirestoreListenerCreated,
  logFirestoreListenerDestroyed,
} from '@/src/services/firebase/firestore-debug';
import {
  getDocumentCacheFirst,
  getQueryCacheFirst,
  invalidateCacheEntry,
} from '@/src/services/repositories/firestore-cache-first';
import { clearSessionCacheByPrefix } from '@/src/services/repositories/session-cache';
import { isSystemPrincipalUser } from '@/src/utils/users/user-protection';
import {
  userDocRef,
  usersCollectionRef,
} from '@/src/lib/firebase/refs';
import {
  AppUser,
  CreateUserDTO,
  UpdateUserDTO,
  USER_SERVICE_DEPARTMENT_LABELS,
  UserServiceDepartment,
  UserServiceAssignment,
  UserServicePosition,
  UserGender,
  UserPermissions,
  UserRole,
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

const USER_PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const USERS_QUERY_CACHE_TTL_MS = 60 * 1000;

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
    // Campos del módulo de limpieza
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

const sortUsers = (items: AppUser[]): AppUser[] => {
  return [...items].sort((a, b) => {
    const left = String(a.displayName || a.email || a.uid || '').toLowerCase();
    const right = String(b.displayName || b.email || b.uid || '').toLowerCase();
    return left.localeCompare(right, 'es');
  });
};

const canonicalUserKey = (user: AppUser): string => {
  const email = user.email.trim().toLowerCase();
  return email || `uid:${user.uid}`;
};

const preferUserRecord = (current: AppUser, candidate: AppUser): AppUser => {
  if (candidate.isActive !== current.isActive) {
    return candidate.isActive ? candidate : current;
  }

  const currentHasService = (current.serviceAssignments?.length ?? 0) > 0 || Boolean(current.department);
  const candidateHasService = (candidate.serviceAssignments?.length ?? 0) > 0 || Boolean(candidate.department);
  if (candidateHasService !== currentHasService) {
    return candidateHasService ? candidate : current;
  }

  return current;
};

const dedupeUsersByEmail = (items: AppUser[]): AppUser[] => {
  const byKey = new Map<string, AppUser>();

  items.forEach((user) => {
    const key = canonicalUserKey(user);
    const existing = byKey.get(key);
    byKey.set(key, existing ? preferUserRecord(existing, user) : user);
  });

  return Array.from(byKey.values());
};

const isIncompleteProfile = (user: AppUser): boolean =>
  user.uid.trim().length === 0 || user.congregationId.trim().length === 0;

/** Obtiene un usuario por UID */
export const getUserById = async (
  uid: string,
  options?: { forceServer?: boolean; maxAgeMs?: number }
): Promise<AppUser | null> => {
  if (!uid || typeof uid !== 'string') return null;

  return getDocumentCacheFirst<AppUser>({
    cacheKey: `users/${uid}`,
    ref: userDocRef(uid),
    mapSnapshot: (snapshot) => normalizeUser(snapshot.id, snapshot.data() as Record<string, unknown>),
    maxAgeMs: options?.maxAgeMs ?? USER_PROFILE_CACHE_TTL_MS,
    forceServer: options?.forceServer,
    isIncomplete: isIncompleteProfile,
  });
};

/** Perfil del usuario autenticado con estrategia cache-first */
export const getCurrentUserProfile = async (
  uid: string,
  options?: { forceServer?: boolean }
): Promise<AppUser | null> => {
  return getUserById(uid, {
    forceServer: options?.forceServer,
    maxAgeMs: USER_PROFILE_CACHE_TTL_MS,
  });
};

/** Obtiene todos los usuarios de una congregacion */
export const getAllUsers = async (
  congregationId: string,
  options?: { forceServer?: boolean }
): Promise<AppUser[]> => {
  if (!congregationId || typeof congregationId !== 'string') {
    return [];
  }

  const q = query(usersCollectionRef(), where('congregationId', '==', congregationId));

  return getQueryCacheFirst<AppUser[]>({
    cacheKey: `users/congregation/${congregationId}`,
    query: q,
    maxAgeMs: USERS_QUERY_CACHE_TTL_MS,
    forceServer: options?.forceServer,
    mapSnapshot: (snapshot) =>
      sortUsers(
        dedupeUsersByEmail(
          snapshot.docs
            .map((docSnapshot) => normalizeUser(docSnapshot.id, docSnapshot.data()))
            .filter((user) => !isSystemPrincipalUser(user))
        )
      ),
  });
};

/** Obtiene usuarios activos de una congregacion */
export const getActiveUsers = async (congregationId: string): Promise<AppUser[]> => {
  const q = query(
    usersCollectionRef(),
    where('congregationId', '==', congregationId),
    where('isActive', '==', true),
    orderBy('displayName', 'asc')
  );
  const snap = await getDocs(q);
  return sortUsers(
    dedupeUsersByEmail(
      snap.docs
        .map((d) => normalizeUser(d.id, d.data()))
        .filter((user) => !isSystemPrincipalUser(user))
    )
  );
};

/** Crea o actualiza el perfil de usuario en Firestore */
export const createUserProfile = async (
  uid: string,
  data: Omit<CreateUserDTO, 'password'>
): Promise<void> => {
  const isActive = data.isActive ?? true;

  await setDoc(userDocRef(uid), {
    ...data,
    emailKey: data.email.trim().toLowerCase(),
    isElder: data.isElder ?? (data.privileges?.isElder === true),
    isMinisterialServant:
      data.isMinisterialServant ?? (data.privileges?.isMinisterialServant === true),
    isActive,
    status: isActive ? 'active' : 'inactive',
    createdBy: data.createdBy,
    createdByName: data.createdByName,
    createdByEmail: data.createdByEmail,
    updatedBy: data.updatedBy,
    updatedByName: data.updatedByName,
    updatedByEmail: data.updatedByEmail,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  invalidateCacheEntry(`users/${uid}`);
  clearSessionCacheByPrefix('query:users/');
};

/** Actualiza un usuario */
export const updateUser = async (
  uid: string,
  data: UpdateUserDTO
): Promise<void> => {
  const payload: Record<string, unknown> = {
    ...data,
    updatedAt: serverTimestamp(),
  };

  if (typeof data.isActive === 'boolean' && !data.status) {
    payload.status = data.isActive ? 'active' : 'inactive';
  }

  if (data.status && typeof data.isActive !== 'boolean') {
    payload.isActive = data.status === 'active';
  }

  await updateDoc(userDocRef(uid), payload);
  invalidateCacheEntry(`users/${uid}`);
  clearSessionCacheByPrefix('query:users/');
};

/** Elimina un usuario de Firestore (no de Auth) */
export const deleteUser = async (uid: string): Promise<void> => {
  await deleteDoc(userDocRef(uid));
  invalidateCacheEntry(`users/${uid}`);
  clearSessionCacheByPrefix('query:users/');
};

export const getUsersCount = async (congregationId: string): Promise<number> => {
  const users = await getAllUsers(congregationId);
  return users.length;
};

/** Suscripcion en tiempo real a usuarios por congregacion */
export const subscribeToUsers = (
  congregationId: string,
  callback: (users: AppUser[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe => {
  if (!congregationId || typeof congregationId !== 'string') {
    onError?.(new Error('No existe congregationId para cargar usuarios.'));
    return () => {};
  }

  const q = query(usersCollectionRef(), where('congregationId', '==', congregationId));
  const listenerKey = `users:congregation:${congregationId}`;
  logFirestoreListenerCreated(listenerKey);

  const unsubscribe = onSnapshot(
    q,
    (snap) => {
      const users = sortUsers(
        dedupeUsersByEmail(
          snap.docs
            .map((d) => normalizeUser(d.id, d.data()))
            .filter((user) => !isSystemPrincipalUser(user))
        )
      );
      callback(users);
    },
    (error) => {
      console.error('subscribeToUsers error:', error);
      onError?.(error);
    }
  );

  return () => {
    logFirestoreListenerDestroyed(listenerKey);
    unsubscribe();
  };
};

/** Suscripcion en tiempo real a un usuario especifico */
export const subscribeToUser = (
  uid: string,
  callback: (user: AppUser | null) => void,
  onError?: (error: unknown) => void
): Unsubscribe => {
  const listenerKey = `users:doc:${uid}`;
  logFirestoreListenerCreated(listenerKey);

  const unsubscribe = onSnapshot(
    userDocRef(uid),
    (snap) => {
      callback(snap.exists() ? normalizeUser(snap.id, snap.data()) : null);
    },
    onError
  );

  return () => {
    logFirestoreListenerDestroyed(listenerKey);
    unsubscribe();
  };
};
