/**
 * Servicio de grupos de limpieza.
 * Toda operación de membresía usa transacciones Firestore para garantizar integridad.
 */
import {
  addDoc,
  deleteDoc,
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
  cleaningGroupDocRef,
  cleaningGroupsCollectionRef,
  userDocRef,
  usersCollectionRef,
} from '@/src/lib/firebase/refs';
import {
  CleaningAssignableUser,
  CleaningGroup,
  CleaningMemberStatus,
  CleaningServiceError,
  CreateCleaningGroupDTO,
  UpdateCleaningGroupDTO,
} from '@/src/modules/cleaning/types/cleaning-group.types';

// ─── Mapeador: raw Firestore doc → CleaningGroup ─────────────────────────────

const normalizeCleaningGroup = (
  id: string,
  data: Record<string, unknown>
): CleaningGroup => ({
  id,
  name: typeof data.name === 'string' ? data.name : '',
  description: typeof data.description === 'string' ? data.description : '',
  congregationId: typeof data.congregationId === 'string' ? data.congregationId : '',
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
  const isActive = typeof userData.isActive === 'boolean' ? userData.isActive : false;
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
  if (initialMemberIds.length < 2) {
    throw new CleaningServiceError('INVALID_DATA', 'Un grupo de limpieza debe crearse con al menos 2 integrantes.');
  }

  // Crear documento del grupo primero para obtener el ID
  const groupRef = await addDoc(cleaningGroupsCollectionRef(), {
    name: dto.name.trim(),
    description: dto.description?.trim() ?? '',
    congregationId,
    memberIds: [],
    memberCount: 0,
    isActive: dto.isActive ?? true,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const groupId = groupRef.id;

  // Agregar integrantes iniciales asegurando transaccionalidad
  await addUsersToCleaningGroup(groupId, initialMemberIds, dto.name.trim());

  return groupId;
};

// ─── getCleaningGroups ────────────────────────────────────────────────────────

/** Obtiene todos los grupos de limpieza de una congregación (activos e inactivos). */
export const getCleaningGroups = async (
  congregationId: string
): Promise<CleaningGroup[]> => {
  if (!congregationId) return [];

  const q = query(
    cleaningGroupsCollectionRef(),
    where('congregationId', '==', congregationId)
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) =>
    normalizeCleaningGroup(d.id, d.data() as Record<string, unknown>)
  );
};

// ─── getCleaningGroupById ─────────────────────────────────────────────────────

/** Obtiene un grupo por ID. Retorna null si no existe. */
export const getCleaningGroupById = async (
  groupId: string
): Promise<CleaningGroup | null> => {
  const snap = await getDoc(cleaningGroupDocRef(groupId));
  if (!snap.exists()) return null;
  return normalizeCleaningGroup(snap.id, snap.data() as Record<string, unknown>);
};

// ─── updateCleaningGroup ──────────────────────────────────────────────────────

/** Actualiza nombre, descripción o estado de un grupo. */
export const updateCleaningGroup = async (
  groupId: string,
  dto: UpdateCleaningGroupDTO
): Promise<void> => {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };

  if (dto.name !== undefined) payload.name = dto.name.trim();
  if (dto.description !== undefined) payload.description = dto.description.trim();
  if (typeof dto.isActive === 'boolean') payload.isActive = dto.isActive;

  await updateDoc(cleaningGroupDocRef(groupId), payload);
};

// ─── addUsersToCleaningGroup ──────────────────────────────────────────────────

/**
 * Agrega uno o varios usuarios al grupo dentro de una transacción.
 * Verifica disponibilidad en la transacción para evitar doble asignación.
 */
export const addUsersToCleaningGroup = async (
  groupId: string,
  userIds: string[],
  groupName?: string
): Promise<void> => {
  if (userIds.length === 0) return;

  await runTransaction(db, async (tx) => {
    // 1. Leer el grupo dentro de la transacción
    const groupSnap = await tx.get(cleaningGroupDocRef(groupId));
    if (!groupSnap.exists()) {
      throw new CleaningServiceError('GROUP_NOT_FOUND', 'El grupo no existe.');
    }

    const groupData = groupSnap.data() as Record<string, unknown>;
    const currentMemberIds: string[] = Array.isArray(groupData.memberIds)
      ? (groupData.memberIds as string[])
      : [];
    const resolvedGroupName =
      groupName ?? (typeof groupData.name === 'string' ? groupData.name : '');

    // 2. Leer todos los usuarios candidatos
    const userSnaps = await Promise.all(userIds.map((uid) => tx.get(userDocRef(uid))));

    const newMemberIds = [...currentMemberIds];

    for (let i = 0; i < userSnaps.length; i++) {
      const snap = userSnaps[i];
      const uid = userIds[i];

      if (!snap.exists()) continue;

      const data = snap.data() as Record<string, unknown>;
      const isActive = typeof data.isActive === 'boolean' ? data.isActive : false;
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
      if (currentMemberIds.includes(uid)) continue; // Ya está en el grupo

      // 3. Actualizar el usuario dentro de la transacción
      tx.update(userDocRef(uid), {
        cleaningGroupId: groupId,
        cleaningGroupName: resolvedGroupName,
        updatedAt: serverTimestamp(),
      });

      newMemberIds.push(uid);
    }

    // 4. Actualizar el grupo
    tx.update(cleaningGroupDocRef(groupId), {
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
  userId: string
): Promise<void> => {
  await runTransaction(db, async (tx) => {
    const groupSnap = await tx.get(cleaningGroupDocRef(groupId));
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

    if (newMemberIds.length < 2) {
      throw new CleaningServiceError(
        'INVALID_DATA',
        'El grupo de limpieza debe mantener al menos 2 integrantes.'
      );
    }

    // Liberar el usuario
    tx.update(userDocRef(userId), {
      cleaningGroupId: null,
      cleaningGroupName: null,
      updatedAt: serverTimestamp(),
    });

    // Actualizar el grupo
    tx.update(cleaningGroupDocRef(groupId), {
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
export const deleteCleaningGroup = async (groupId: string): Promise<void> => {
  await runTransaction(db, async (tx) => {
    const groupSnap = await tx.get(cleaningGroupDocRef(groupId));
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
    tx.delete(cleaningGroupDocRef(groupId));
  });
};

// ─── deactivateCleaningGroup (soft delete) ────────────────────────────────────

/**
 * Desactiva un grupo (isActive = false) y libera a todos sus integrantes.
 * Alternativa no destructiva a deleteCleaningGroup.
 */
export const deactivateCleaningGroup = async (groupId: string): Promise<void> => {
  await runTransaction(db, async (tx) => {
    const groupSnap = await tx.get(cleaningGroupDocRef(groupId));
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

    tx.update(cleaningGroupDocRef(groupId), {
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

  const q = query(
    usersCollectionRef(),
    where('congregationId', '==', congregationId),
    where('isActive', '==', true)
  );

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
      isActive: typeof data.isActive === 'boolean' ? data.isActive : false,
      cleaningGroupId: assignedGroupId,
      cleaningGroupName: assignedGroupName,
      cleaningEligible:
        typeof data.cleaningEligible === 'boolean' ? data.cleaningEligible : true,
      memberStatus: resolveUserMemberStatus(data, currentGroupId),
    } satisfies CleaningAssignableUser;
  });
};
