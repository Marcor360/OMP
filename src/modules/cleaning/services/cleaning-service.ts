/**
 * Servicio de grupos de limpieza.
 * Toda operación de membresía usa transacciones Firestore para garantizar integridad.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  getDoc,
} from 'firebase/firestore';

import { db } from '@/src/lib/firebase/app';
import {
  userDocRef,
  usersCollectionRef,
} from '@/src/lib/firebase/refs';
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

const resolveUserCongregationId = (userData: Record<string, unknown>): string | null => {
  if (typeof userData.congregationId === 'string' && userData.congregationId.length > 0) {
    return userData.congregationId;
  }
  return null;
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

/**
 * Crea un grupo nuevo y agrega integrantes iniciales en una sola transacción.
 * Si initialMemberIds está vacío, solo crea el grupo.
 */
export const createCleaningGroup = async (
  congregationId: string,
  dto: CreateCleaningGroupDTO,
  createdBy: string,
  initialMemberIds: string[] = []
): Promise<string> => {
  if (!congregationId) {
    throw new CleaningServiceError('INVALID_DATA', 'congregationId es requerido.');
  }
  if (!dto.name.trim()) {
    throw new CleaningServiceError('INVALID_DATA', 'El nombre del grupo es requerido.');
  }
  const payload = {
    name: dto.name.trim(),
    description: dto.description?.trim() ?? '',
    congregationId,
    groupType: dto.groupType ?? 'standard',
    memberIds: [],
    memberCount: 0,
    isActive: dto.isActive ?? true,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const storageModes = resolveGroupStorageModes(congregationId);
  let selectedStorageMode: CleaningGroupStorageMode = storageModes[0];
  let groupRef: Awaited<ReturnType<typeof addDoc>> | null = null;
  let permissionError: unknown = null;

  for (const mode of storageModes) {
    try {
      groupRef = await addDoc(cleaningGroupsCollectionRefByMode(mode, congregationId), payload);
      selectedStorageMode = mode;
      break;
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        permissionError = permissionError ?? error;
        continue;
      }
      throw error;
    }
  }

  if (!groupRef) {
    if (permissionError) throw permissionError;
    throw new CleaningServiceError(
      'TRANSACTION_FAILED',
      'No se pudo crear el grupo de limpieza.'
    );
  }

  const groupId = groupRef.id;

  if (initialMemberIds.length > 0) {
    try {
      // Agregar integrantes iniciales asegurando transaccionalidad
      await addUsersToCleaningGroup(
        groupId,
        initialMemberIds,
        dto.name.trim(),
        {
          congregationId,
          storageMode: selectedStorageMode,
        }
      );
    } catch (error) {
      // Rollback defensivo si falla la asignacion inicial.
      await deleteDoc(
        cleaningGroupDocRefByMode(selectedStorageMode, groupId, congregationId)
      );
      throw error;
    }
  }

  return groupId;
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
    throw permissionError;
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

/**
 * Agrega uno o varios usuarios al grupo dentro de una transacción.
 * Verifica disponibilidad en la transacción para evitar doble asignación.
 */
export const addUsersToCleaningGroup = async (
  groupId: string,
  userIds: string[],
  groupName?: string,
  options?: {
    congregationId?: string | null;
    storageMode?: CleaningGroupStorageMode;
  }
): Promise<void> => {
  if (userIds.length === 0) return;
  const uniqueUserIds = Array.from(new Set(userIds));
  const storageMode =
    options?.storageMode ??
    (await resolveExistingGroupStorageMode(groupId, options?.congregationId));
  const groupRef = cleaningGroupDocRefByMode(
    storageMode,
    groupId,
    options?.congregationId
  );

  await runTransaction(db, async (tx) => {
    // 1. Leer el grupo dentro de la transacción
    const groupSnap = await tx.get(groupRef);
    if (!groupSnap.exists()) {
      throw new CleaningServiceError('GROUP_NOT_FOUND', 'El grupo no existe.');
    }

    const groupData = groupSnap.data() as Record<string, unknown>;
    const currentMemberIds: string[] = Array.isArray(groupData.memberIds)
      ? (groupData.memberIds as string[])
      : [];
    const groupCongregationId =
      typeof groupData.congregationId === 'string' ? groupData.congregationId : '';
    const resolvedGroupName =
      groupName ?? (typeof groupData.name === 'string' ? groupData.name : '');

    // 2. Leer todos los usuarios candidatos
    const userSnaps = await Promise.all(
      uniqueUserIds.map((uid) => tx.get(userDocRef(uid)))
    );

    const newMemberIds = [...currentMemberIds];

    for (let i = 0; i < userSnaps.length; i++) {
      const snap = userSnaps[i];
      const uid = uniqueUserIds[i];

      if (!snap.exists()) continue;

      const data = snap.data() as Record<string, unknown>;
      const userCongregationId = resolveUserCongregationId(data);
      if (
        groupCongregationId.length > 0 &&
        (!userCongregationId || userCongregationId !== groupCongregationId)
      ) {
        throw new CleaningServiceError(
          'INVALID_DATA',
          `El usuario "${data.displayName ?? uid}" no pertenece a la congregacion del grupo.`
        );
      }

      const isActive = resolveIsUserActive(data);
      const eligible =
        typeof data.cleaningEligible === 'boolean' ? data.cleaningEligible : true;
      const existingGroupId =
        typeof data.cleaningGroupId === 'string' && data.cleaningGroupId.length > 0
          ? data.cleaningGroupId
          : null;

      // Validación fuerte: si ya tiene grupo diferente, lanzar error
      if (existingGroupId && existingGroupId !== groupId) {
        const existingName =
          typeof data.cleaningGroupName === 'string'
            ? data.cleaningGroupName
            : 'otro grupo';
        throw new CleaningServiceError(
          'USER_ALREADY_ASSIGNED',
          `El usuario "${data.displayName ?? uid}" ya pertenece a "${existingName}".`
        );
      }

      if (!isActive || !eligible) continue; // Omitir sin error
      if (newMemberIds.includes(uid)) continue; // Ya está en el grupo

      // 3. Actualizar el usuario dentro de la transacción
      tx.update(userDocRef(uid), {
        cleaningGroupId: groupId,
        cleaningGroupName: resolvedGroupName,
        updatedAt: serverTimestamp(),
      });

      newMemberIds.push(uid);
    }

    // 4. Actualizar el grupo
    tx.update(groupRef, {
      memberIds: newMemberIds,
      memberCount: newMemberIds.length,
      updatedAt: serverTimestamp(),
    });
  });
};

// ─── removeUserFromCleaningGroup ──────────────────────────────────────────────

/**
 * Remueve un usuario del grupo liberando cleaningGroupId y cleaningGroupName.
 * Usa transacción para garantizar consistencia.
 */
export const removeUserFromCleaningGroup = async (
  groupId: string,
  userId: string,
  congregationId?: string | null
): Promise<void> => {
  const storageMode = await resolveExistingGroupStorageMode(groupId, congregationId);
  const groupRef = cleaningGroupDocRefByMode(storageMode, groupId, congregationId);

  await runTransaction(db, async (tx) => {
    const groupSnap = await tx.get(groupRef);
    if (!groupSnap.exists()) {
      throw new CleaningServiceError('GROUP_NOT_FOUND', 'El grupo no existe.');
    }

    const groupData = groupSnap.data() as Record<string, unknown>;
    const currentMemberIds: string[] = Array.isArray(groupData.memberIds)
      ? (groupData.memberIds as string[])
      : [];

    if (!currentMemberIds.includes(userId)) {
      throw new CleaningServiceError(
        'USER_NOT_IN_GROUP',
        'El usuario no pertenece a este grupo.'
      );
    }

    const newMemberIds = currentMemberIds.filter((id) => id !== userId);

    // Liberar el usuario
    tx.update(userDocRef(userId), {
      cleaningGroupId: null,
      cleaningGroupName: null,
      updatedAt: serverTimestamp(),
    });

    // Actualizar el grupo
    tx.update(groupRef, {
      memberIds: newMemberIds,
      memberCount: newMemberIds.length,
      updatedAt: serverTimestamp(),
    });
  });
};

// ─── deleteCleaningGroup ──────────────────────────────────────────────────────

/**
 * Elimina un grupo (hard delete).
 * Primero libera a todos sus integrantes dentro de una transacción.
 */
export const deleteCleaningGroup = async (
  groupId: string,
  congregationId?: string | null
): Promise<void> => {
  const storageMode = await resolveExistingGroupStorageMode(groupId, congregationId);
  const groupRef = cleaningGroupDocRefByMode(storageMode, groupId, congregationId);

  await runTransaction(db, async (tx) => {
    const groupSnap = await tx.get(groupRef);
    if (!groupSnap.exists()) {
      throw new CleaningServiceError('GROUP_NOT_FOUND', 'El grupo no existe.');
    }

    const groupData = groupSnap.data() as Record<string, unknown>;
    const memberIds: string[] = Array.isArray(groupData.memberIds)
      ? (groupData.memberIds as string[])
      : [];

    // Liberar integrantes
    for (const uid of memberIds) {
      tx.update(userDocRef(uid), {
        cleaningGroupId: null,
        cleaningGroupName: null,
        updatedAt: serverTimestamp(),
      });
    }

    // Eliminar el grupo
    tx.delete(groupRef);
  });
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
  const storageMode = await resolveExistingGroupStorageMode(groupId, congregationId);
  const groupRef = cleaningGroupDocRefByMode(storageMode, groupId, congregationId);

  await runTransaction(db, async (tx) => {
    const groupSnap = await tx.get(groupRef);
    if (!groupSnap.exists()) {
      throw new CleaningServiceError('GROUP_NOT_FOUND', 'El grupo no existe.');
    }

    const groupData = groupSnap.data() as Record<string, unknown>;
    const memberIds: string[] = Array.isArray(groupData.memberIds)
      ? (groupData.memberIds as string[])
      : [];

    for (const uid of memberIds) {
      tx.update(userDocRef(uid), {
        cleaningGroupId: null,
        cleaningGroupName: null,
        updatedAt: serverTimestamp(),
      });
    }

    tx.update(groupRef, {
      isActive: false,
      memberIds: [],
      memberCount: 0,
      updatedAt: serverTimestamp(),
    });
  });
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

  const q = query(usersCollectionRef(), where('congregationId', '==', congregationId));

  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const uid = d.id;
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
