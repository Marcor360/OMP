/**
 * Servicio de grupos de limpieza.
 * Toda operación de membresía usa transacciones Firestore para garantizar integridad.
 */
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  getDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from '@/src/lib/firebase/app';
import { getAllUsers } from '@/src/services/users/users-service';
import {
  CleaningAssignableUser,
  CleaningGroup,
  CleaningGroupType,
  CleaningMemberStatus,
  CleaningServiceError,
  CreateCleaningGroupDTO,
  UpdateCleaningGroupDTO,
} from '@/src/modules/cleaning/types/cleaning-group.types';

const resolveIsUserActive = (userData: Record<string, unknown>): boolean => {
  if (typeof userData.isActive === 'boolean') return userData.isActive;
  if (typeof userData.active === 'boolean') return userData.active;
  if (typeof userData.status === 'string') return userData.status === 'active';
  return false;
};

const resolveCleaningGroupType = (value: unknown): CleaningGroupType =>
  value === 'family' ? 'family' : 'standard';

const CLEANING_GROUP_COLLECTION_CANDIDATES = [
  'cleaningGroups',
  'cleaning_groups',
] as const;

type CleaningGroupCollectionName = (typeof CLEANING_GROUP_COLLECTION_CANDIDATES)[number];
type CleaningGroupStorageMode = 'scoped' | 'scoped_legacy' | CleaningGroupCollectionName;

const isPermissionDeniedError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) return false;
  if (!('code' in error)) return false;
  return String((error as { code?: unknown }).code) === 'permission-denied';
};

type ListCleaningGroupsResponse = {
  groups?: (Record<string, unknown> & { id?: string })[];
};

const listCleaningGroupsViaFunction = async (
  congregationId: string
): Promise<CleaningGroup[]> => {
  const callable = httpsCallable<Record<string, never>, ListCleaningGroupsResponse>(
    functions,
    'listCleaningGroupsForCurrentUser'
  );
  const result = await callable({});
  const groups = Array.isArray(result.data.groups) ? result.data.groups : [];

  return groups.map((group) => {
    const id = typeof group.id === 'string' ? group.id : '';
    const normalized = normalizeCleaningGroup(id, group);
    return normalized.congregationId ? normalized : { ...normalized, congregationId };
  });
};

const cleaningGroupsCollectionRefByName = (collectionName: CleaningGroupCollectionName) =>
  collection(db, collectionName);

const cleaningGroupDocRefByName = (
  collectionName: CleaningGroupCollectionName,
  groupId: string
) => doc(db, collectionName, groupId);

const cleaningGroupsScopedCollectionRef = (congregationId: string) =>
  collection(db, 'congregations', congregationId, 'cleaningGroups');

const cleaningGroupsScopedLegacyCollectionRef = (congregationId: string) =>
  collection(db, 'congregations', congregationId, 'cleaning_groups');

const cleaningGroupScopedDocRef = (congregationId: string, groupId: string) =>
  doc(db, 'congregations', congregationId, 'cleaningGroups', groupId);

const cleaningGroupScopedLegacyDocRef = (congregationId: string, groupId: string) =>
  doc(db, 'congregations', congregationId, 'cleaning_groups', groupId);

const resolveGroupStorageModes = (
  congregationId?: string | null
): CleaningGroupStorageMode[] =>
  congregationId && congregationId.trim().length > 0
    ? ['scoped', 'scoped_legacy', ...CLEANING_GROUP_COLLECTION_CANDIDATES]
    : [...CLEANING_GROUP_COLLECTION_CANDIDATES];

const cleaningGroupsCollectionRefByMode = (
  mode: CleaningGroupStorageMode,
  congregationId?: string | null
) => {
  if (mode === 'scoped' || mode === 'scoped_legacy') {
    if (!congregationId) {
      throw new CleaningServiceError(
        'INVALID_DATA',
        'congregationId es requerido para consultar grupos de limpieza.'
      );
    }
    return mode === 'scoped'
      ? cleaningGroupsScopedCollectionRef(congregationId)
      : cleaningGroupsScopedLegacyCollectionRef(congregationId);
  }
  return cleaningGroupsCollectionRefByName(mode);
};

const cleaningGroupDocRefByMode = (
  mode: CleaningGroupStorageMode,
  groupId: string,
  congregationId?: string | null
) => {
  if (mode === 'scoped' || mode === 'scoped_legacy') {
    if (!congregationId) {
      throw new CleaningServiceError(
        'INVALID_DATA',
        'congregationId es requerido para acceder al grupo de limpieza.'
      );
    }
    return mode === 'scoped'
      ? cleaningGroupScopedDocRef(congregationId, groupId)
      : cleaningGroupScopedLegacyDocRef(congregationId, groupId);
  }
  return cleaningGroupDocRefByName(mode, groupId);
};

const resolveExistingGroupStorageMode = async (
  groupId: string,
  congregationId?: string | null
): Promise<CleaningGroupStorageMode> => {
  let permissionError: unknown = null;
  let hadReadableCollection = false;
  const modes = resolveGroupStorageModes(congregationId);

  for (const mode of modes) {
    try {
      const snap = await getDoc(cleaningGroupDocRefByMode(mode, groupId, congregationId));
      hadReadableCollection = true;
      if (snap.exists()) {
        return mode;
      }
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        permissionError = permissionError ?? error;
        continue;
      }
      throw error;
    }
  }

  if (!hadReadableCollection && permissionError) {
    throw permissionError;
  }

  return modes[0];
};

// ─── Mapeador: raw Firestore doc → CleaningGroup ─────────────────────────────

const normalizeCleaningGroup = (
  id: string,
  data: Record<string, unknown>
): CleaningGroup => ({
  id,
  name: typeof data.name === 'string' ? data.name : '',
  description: typeof data.description === 'string' ? data.description : '',
  congregationId: typeof data.congregationId === 'string' ? data.congregationId : '',
  groupType: resolveCleaningGroupType(data.groupType),
  memberIds: Array.isArray(data.memberIds)
    ? (data.memberIds as string[]).filter((v) => typeof v === 'string')
    : [],
  memberCount: typeof data.memberCount === 'number' ? data.memberCount : 0,
  isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
  createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
  createdAt: data.createdAt as CleaningGroup['createdAt'],
  updatedAt: data.updatedAt as CleaningGroup['updatedAt'],
});

// ─── Mapeador: AppUser raw → CleaningAssignableUser ──────────────────────────

const resolveUserMemberStatus = (
  userData: Record<string, unknown>,
  currentGroupId: string | null
): CleaningMemberStatus => {
  const isActive = resolveIsUserActive(userData);
  const eligible =
    typeof userData.cleaningEligible === 'boolean' ? userData.cleaningEligible : true;
  const assignedGroupId =
    typeof userData.cleaningGroupId === 'string' && userData.cleaningGroupId.length > 0
      ? userData.cleaningGroupId
      : null;

  if (!isActive) return 'inactive';
  if (!eligible) return 'not_eligible';
  if (assignedGroupId === null) return 'available';
  if (currentGroupId && assignedGroupId === currentGroupId) return 'assigned_here';
  return 'assigned_other';
};

// ─── createCleaningGroup ──────────────────────────────────────────────────────

const mapCallableErrorToCleaningError = (error: unknown): CleaningServiceError => {
  if (error instanceof CleaningServiceError) return error;

  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message)
      : 'No se pudo completar la operacion de limpieza.';

  if (code.includes('permission-denied') || code.includes('unauthenticated')) {
    return new CleaningServiceError('PERMISSION_DENIED', message);
  }
  if (code.includes('invalid-argument')) {
    return new CleaningServiceError('INVALID_DATA', message);
  }
  if (code.includes('failed-precondition')) {
    if (message === 'El usuario no pertenece a este grupo.') {
      return new CleaningServiceError('USER_NOT_IN_GROUP', message);
    }
    return new CleaningServiceError('INVALID_DATA', message);
  }
  if (code.includes('not-found')) {
    return new CleaningServiceError('GROUP_NOT_FOUND', message);
  }
  return new CleaningServiceError('TRANSACTION_FAILED', message);
};

/**
 * Crea un grupo (y sus integrantes iniciales, atomicamente) via Cloud Function.
 * La autorizacion y la validacion ocurren server-side.
 */
export const createCleaningGroup = async (
  congregationId: string,
  dto: CreateCleaningGroupDTO,
  initialMemberIds: string[] = []
): Promise<string> => {
  if (!congregationId) {
    throw new CleaningServiceError('INVALID_DATA', 'congregationId es requerido.');
  }
  if (!dto.name.trim()) {
    throw new CleaningServiceError('INVALID_DATA', 'El nombre del grupo es requerido.');
  }

  const callable = httpsCallable<
    {
      congregationId: string;
      name: string;
      description: string;
      groupType: CleaningGroupType;
      isActive: boolean;
      initialMemberIds: string[];
    },
    { groupId?: string }
  >(functions, 'createCleaningGroupByManager');

  try {
    const result = await callable({
      congregationId,
      name: dto.name.trim(),
      description: dto.description?.trim() ?? '',
      groupType: dto.groupType ?? 'standard',
      isActive: dto.isActive ?? true,
      initialMemberIds: Array.from(new Set(initialMemberIds)),
    });
    const groupId = typeof result.data.groupId === 'string' ? result.data.groupId : '';
    if (!groupId) {
      throw new CleaningServiceError('TRANSACTION_FAILED', 'No se pudo crear el grupo de limpieza.');
    }
    return groupId;
  } catch (error) {
    throw mapCallableErrorToCleaningError(error);
  }
};

// ─── getCleaningGroups ────────────────────────────────────────────────────────

/** Obtiene todos los grupos de limpieza de una congregación (activos e inactivos). */
export const getCleaningGroups = async (
  congregationId: string
): Promise<CleaningGroup[]> => {
  if (!congregationId) return [];
  let permissionError: unknown = null;
  let hadReadableCollection = false;
  const storageModes = resolveGroupStorageModes(congregationId);

  for (const mode of storageModes) {
    try {
      const q =
        mode === 'scoped' || mode === 'scoped_legacy'
          ? query(cleaningGroupsCollectionRefByMode(mode, congregationId))
          : query(
              cleaningGroupsCollectionRefByMode(mode, congregationId),
              where('congregationId', '==', congregationId)
            );
      const snap = await getDocs(q);

      hadReadableCollection = true;
      if (snap.size === 0) {
        continue;
      }

      return snap.docs.map((d) => {
        const group = normalizeCleaningGroup(d.id, d.data() as Record<string, unknown>);
        if (!group.congregationId) {
          return { ...group, congregationId };
        }
        return group;
      });
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        permissionError = permissionError ?? error;
        continue;
      }
      throw error;
    }
  }

  if (hadReadableCollection) {
    return [];
  }
  if (permissionError) {
    return listCleaningGroupsViaFunction(congregationId);
  }

  return [];
};

// ─── getCleaningGroupById ─────────────────────────────────────────────────────

/** Obtiene un grupo por ID. Retorna null si no existe. */
export const getCleaningGroupById = async (
  groupId: string,
  congregationId?: string | null
): Promise<CleaningGroup | null> => {
  let permissionError: unknown = null;
  const storageModes = resolveGroupStorageModes(congregationId);

  for (const mode of storageModes) {
    try {
      const snap = await getDoc(cleaningGroupDocRefByMode(mode, groupId, congregationId));
      if (!snap.exists()) continue;

      const group = normalizeCleaningGroup(snap.id, snap.data() as Record<string, unknown>);
      if (!group.congregationId && congregationId) {
        return { ...group, congregationId };
      }
      return group;
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        permissionError = permissionError ?? error;
        continue;
      }
      throw error;
    }
  }

  if (permissionError) {
    throw permissionError;
  }

  return null;
};

// ─── updateCleaningGroup ──────────────────────────────────────────────────────

/** Actualiza nombre, descripción o estado de un grupo. */
export const updateCleaningGroup = async (
  groupId: string,
  dto: UpdateCleaningGroupDTO,
  congregationId?: string | null
): Promise<void> => {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };

  if (dto.name !== undefined) payload.name = dto.name.trim();
  if (dto.description !== undefined) payload.description = dto.description.trim();
  if (dto.groupType !== undefined) payload.groupType = dto.groupType;
  if (typeof dto.isActive === 'boolean') payload.isActive = dto.isActive;

  const storageMode = await resolveExistingGroupStorageMode(groupId, congregationId);
  await updateDoc(cleaningGroupDocRefByMode(storageMode, groupId, congregationId), payload);
};

// ─── addUsersToCleaningGroup ──────────────────────────────────────────────────

/** Agrega uno o varios usuarios al grupo mediante una Cloud Function. */
export const addUsersToCleaningGroup = async (
  groupId: string,
  userIds: string[],
  congregationId: string
): Promise<void> => {
  if (userIds.length === 0) return;
  if (!congregationId) {
    throw new CleaningServiceError('INVALID_DATA', 'congregationId es requerido.');
  }

  const callable = httpsCallable<
    { congregationId: string; groupId: string; userIds: string[] },
    { added: number; skipped: number }
  >(
    functions,
    'addCleaningGroupMembersByManager'
  );

  try {
    await callable({
      congregationId,
      groupId,
      userIds: Array.from(new Set(userIds)),
    });
  } catch (error) {
    throw mapCallableErrorToCleaningError(error);
  }
};

// ─── removeUserFromCleaningGroup ──────────────────────────────────────────────

/**
 * Remueve un usuario del grupo liberando cleaningGroupId y cleaningGroupName.
 * La Cloud Function valida autorizacion y garantiza consistencia atomica.
 */
export const removeUserFromCleaningGroup = async (
  groupId: string,
  userId: string,
  congregationId?: string | null
): Promise<void> => {
  if (!congregationId) {
    throw new CleaningServiceError('INVALID_DATA', 'congregationId es requerido.');
  }

  const callable = httpsCallable<
    { congregationId: string; groupId: string; userId: string },
    { removed: true }
  >(functions, 'removeCleaningGroupMemberByManager');

  try {
    await callable({ congregationId, groupId, userId });
  } catch (error) {
    throw mapCallableErrorToCleaningError(error);
  }
};

// ─── deleteCleaningGroup ──────────────────────────────────────────────────────

/**
 * Elimina un grupo (hard delete).
 * La Cloud Function libera a sus integrantes y elimina el grupo.
 */
export const deleteCleaningGroup = async (
  groupId: string,
  congregationId?: string | null
): Promise<void> => {
  if (!congregationId) {
    throw new CleaningServiceError('INVALID_DATA', 'congregationId es requerido.');
  }

  const callable = httpsCallable<
    { congregationId: string; groupId: string },
    { deleted: true; released: number }
  >(functions, 'deleteCleaningGroupByManager');

  try {
    await callable({ congregationId, groupId });
  } catch (error) {
    throw mapCallableErrorToCleaningError(error);
  }
};

// ─── deactivateCleaningGroup (soft delete) ────────────────────────────────────

/**
 * Desactiva un grupo (isActive = false) y libera a todos sus integrantes.
 * Alternativa no destructiva a deleteCleaningGroup.
 */
export const deactivateCleaningGroup = async (
  groupId: string,
  congregationId?: string | null
): Promise<void> => {
  if (!congregationId) {
    throw new CleaningServiceError('INVALID_DATA', 'congregationId es requerido.');
  }

  const callable = httpsCallable<
    { congregationId: string; groupId: string },
    { deactivated: true; released: number }
  >(functions, 'deactivateCleaningGroupByManager');

  try {
    await callable({ congregationId, groupId });
  } catch (error) {
    throw mapCallableErrorToCleaningError(error);
  }
};

// ─── getCleaningAssignableUsers ───────────────────────────────────────────────

/**
 * Retorna usuarios activos de la congregación con su estado de asignabilidad
 * calculado en relación con el grupo especificado.
 * Optimizado: solo consulta usuarios de la congregación (no recorre todos).
 */
export const getCleaningAssignableUsers = async (
  congregationId: string,
  currentGroupId: string | null = null
): Promise<CleaningAssignableUser[]> => {
  if (!congregationId) return [];

  const users = await getAllUsers(congregationId, { forceServer: true });

  return users.map((user) => {
    const data = user as unknown as Record<string, unknown>;
    const uid = user.uid;
    const assignedGroupId =
      typeof data.cleaningGroupId === 'string' && data.cleaningGroupId.length > 0
        ? data.cleaningGroupId
        : null;
    const assignedGroupName =
      typeof data.cleaningGroupName === 'string' && data.cleaningGroupName.length > 0
        ? data.cleaningGroupName
        : null;

    return {
      uid,
      displayName:
        typeof data.displayName === 'string' && data.displayName.length > 0
          ? data.displayName
          : typeof data.email === 'string'
            ? data.email
            : uid,
      email: typeof data.email === 'string' ? data.email : '',
      congregationId: typeof data.congregationId === 'string' ? data.congregationId : '',
      isActive: resolveIsUserActive(data),
      cleaningGroupId: assignedGroupId,
      cleaningGroupName: assignedGroupName,
      cleaningEligible:
        typeof data.cleaningEligible === 'boolean' ? data.cleaningEligible : true,
      memberStatus: resolveUserMemberStatus(data, currentGroupId),
    } satisfies CleaningAssignableUser;
  });
};
