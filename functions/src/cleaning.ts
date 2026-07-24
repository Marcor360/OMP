import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { assertAdministrativeBillingAccess } from './users/authorization.js';

const CLEANING_COLLECTION_PATHS = [
  (congregationId: string) => `congregations/${congregationId}/cleaningGroups`,
  (congregationId: string) => `congregations/${congregationId}/cleaning_groups`,
] as const;

const normalizeGroup = (
  id: string,
  data: FirebaseFirestore.DocumentData,
  congregationId: string
) => ({
  id,
  name: typeof data.name === 'string' ? data.name : '',
  description: typeof data.description === 'string' ? data.description : '',
  congregationId:
    typeof data.congregationId === 'string' && data.congregationId.length > 0
      ? data.congregationId
      : congregationId,
  groupType: data.groupType === 'family' ? 'family' : 'standard',
  memberIds: Array.isArray(data.memberIds)
    ? data.memberIds.filter((value: unknown): value is string => typeof value === 'string')
    : [],
  memberCount: typeof data.memberCount === 'number' ? data.memberCount : 0,
  isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
  createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
  createdAt: data.createdAt ?? null,
  updatedAt: data.updatedAt ?? null,
});

export const listCleaningGroupsForCurrentUser = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const db = getFirestore();
    const userSnap = await db.collection('users').doc(request.auth.uid).get();

    if (!userSnap.exists) {
      throw new HttpsError('permission-denied', 'No se encontro el perfil del usuario.');
    }

    const user = userSnap.data() as Record<string, unknown>;
    const congregationId =
      typeof user.congregationId === 'string' ? user.congregationId : '';
    const isActive = user.isActive === true;

    if (!isActive || !congregationId) {
      throw new HttpsError('permission-denied', 'No tienes permisos para ver limpieza.');
    }

    const byId = new Map<string, ReturnType<typeof normalizeGroup>>();

    for (const resolvePath of CLEANING_COLLECTION_PATHS) {
      const snap = await db.collection(resolvePath(congregationId)).get();
      snap.docs.forEach((doc) => {
        byId.set(doc.id, normalizeGroup(doc.id, doc.data(), congregationId));
      });
    }

    const rootSnap = await db
      .collection('cleaningGroups')
      .where('congregationId', '==', congregationId)
      .get();
    rootSnap.docs.forEach((doc) => {
      if (!byId.has(doc.id)) {
        byId.set(doc.id, normalizeGroup(doc.id, doc.data(), congregationId));
      }
    });

    return {
      groups: Array.from(byId.values()),
    };
  }
);

// --- createCleaningGroupByManager ------------------------------------------------
// Autorizacion server-side que replica el modelo efectivo del frontend:
// encargado de limpieza por position+department (ignora label -> robusto a deriva).

const MAX_CLEANING_NAME = 80;
const MAX_CLEANING_DESCRIPTION = 300;
const MAX_CLEANING_MEMBERS = 200;

type CleaningAssignmentLike = { position?: unknown; department?: unknown };

const hasEncargadoLimpiezaAssignment = (user: Record<string, unknown>): boolean => {
  if (user.servicePosition === 'encargado' && user.serviceDepartment === 'limpieza') {
    return true;
  }

  const assignments = Array.isArray(user.serviceAssignments)
    ? (user.serviceAssignments as CleaningAssignmentLike[])
    : [];

  return assignments.some(
    (assignment) => assignment?.position === 'encargado' && assignment?.department === 'limpieza'
  );
};

const storedLimpiezaFlag = (user: Record<string, unknown>, action: string): boolean => {
  const permissions = user.permissions;
  if (typeof permissions !== 'object' || permissions === null) return false;

  const limpieza = (permissions as Record<string, unknown>).limpieza;
  if (typeof limpieza !== 'object' || limpieza === null) return false;

  return (limpieza as Record<string, unknown>)[action] === true;
};

// Espejo de canManageCleaning (frontend): admin | limpieza.manage | (limpieza.create && edit)
// | encargado de limpieza. Auxiliar de limpieza no gestiona (paridad con frontend y reglas).
const canManageCleaningFromProfile = (user: Record<string, unknown>): boolean => {
  if (user.isActive !== true) return false;
  if (user.role === 'admin' || user.role === 'administrador') return true;
  if (storedLimpiezaFlag(user, 'manage')) return true;
  if (storedLimpiezaFlag(user, 'create') && storedLimpiezaFlag(user, 'edit')) return true;
  return hasEncargadoLimpiezaAssignment(user);
};

const resolveCleaningMemberActive = (user: Record<string, unknown>): boolean => {
  if (typeof user.isActive === 'boolean') return user.isActive;
  if (typeof user.active === 'boolean') return user.active;
  if (typeof user.status === 'string') return user.status === 'active';
  return false;
};

type CreateCleaningGroupPayload = {
  congregationId: string;
  name: string;
  description: string;
  groupType: 'standard' | 'family';
  isActive: boolean;
  initialMemberIds: string[];
};

const parseCreateCleaningGroupPayload = (raw: unknown): CreateCleaningGroupPayload => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new HttpsError('invalid-argument', 'Payload invalido.');
  }

  const data = raw as Record<string, unknown>;
  const congregationId =
    typeof data.congregationId === 'string' ? data.congregationId.trim() : '';
  if (!congregationId) {
    throw new HttpsError('invalid-argument', 'congregationId es requerido.');
  }

  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name) {
    throw new HttpsError('invalid-argument', 'El nombre del grupo es requerido.');
  }
  if (name.length > MAX_CLEANING_NAME) {
    throw new HttpsError(
      'invalid-argument',
      `El nombre no puede exceder ${MAX_CLEANING_NAME} caracteres.`
    );
  }

  const description = typeof data.description === 'string' ? data.description.trim() : '';
  if (description.length > MAX_CLEANING_DESCRIPTION) {
    throw new HttpsError(
      'invalid-argument',
      `La descripcion no puede exceder ${MAX_CLEANING_DESCRIPTION} caracteres.`
    );
  }

  const groupType: 'standard' | 'family' = data.groupType === 'family' ? 'family' : 'standard';
  const isActive = typeof data.isActive === 'boolean' ? data.isActive : true;
  const initialMemberIds = Array.isArray(data.initialMemberIds)
    ? Array.from(
        new Set(
          data.initialMemberIds.filter(
            (value): value is string => typeof value === 'string' && value.length > 0
          )
        )
      )
    : [];

  if (initialMemberIds.length > MAX_CLEANING_MEMBERS) {
    throw new HttpsError(
      'invalid-argument',
      `Un grupo no puede exceder ${MAX_CLEANING_MEMBERS} integrantes.`
    );
  }

  return { congregationId, name, description, groupType, isActive, initialMemberIds };
};

export const createCleaningGroupByManager = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = parseCreateCleaningGroupPayload(request.data);
    const db = getFirestore();
    const requesterSnap = await db.collection('users').doc(uid).get();

    if (!requesterSnap.exists) {
      throw new HttpsError('permission-denied', 'No se encontro el perfil del usuario.');
    }

    const requester = requesterSnap.data() as Record<string, unknown>;
    const requesterCongregationId =
      typeof requester.congregationId === 'string' ? requester.congregationId : '';

    if (requester.isActive !== true || !requesterCongregationId) {
      throw new HttpsError('permission-denied', 'No tienes permisos para gestionar limpieza.');
    }

    if (payload.congregationId !== requesterCongregationId) {
      throw new HttpsError('permission-denied', 'No puedes crear grupos en otra congregacion.');
    }

    await assertAdministrativeBillingAccess(requesterCongregationId);

    if (!canManageCleaningFromProfile(requester)) {
      throw new HttpsError('permission-denied', 'No tienes permisos para gestionar limpieza.');
    }

    const groupRef = db
      .collection('congregations')
      .doc(requesterCongregationId)
      .collection('cleaningGroups')
      .doc();
    const now = FieldValue.serverTimestamp();

    await db.runTransaction(async (transaction) => {
      const memberIds: string[] = [];

      if (payload.initialMemberIds.length > 0) {
        const memberRefs = payload.initialMemberIds.map((memberId) =>
          db.collection('users').doc(memberId)
        );
        const memberSnaps = await Promise.all(memberRefs.map((memberRef) => transaction.get(memberRef)));

        memberSnaps.forEach((snap, index) => {
          const memberId = payload.initialMemberIds[index];
          const memberRef = memberRefs[index];
          if (!memberId || !memberRef || !snap.exists) return;

          const member = snap.data() as Record<string, unknown>;
          const displayName =
            typeof member.displayName === 'string' ? member.displayName : memberId;
          const memberCongregationId =
            typeof member.congregationId === 'string' ? member.congregationId : '';

          if (memberCongregationId !== requesterCongregationId) {
            throw new HttpsError(
              'failed-precondition',
              `El usuario "${displayName}" no pertenece a la congregacion.`
            );
          }

          const existingGroupId =
            typeof member.cleaningGroupId === 'string' && member.cleaningGroupId.length > 0
              ? member.cleaningGroupId
              : null;

          if (existingGroupId) {
            const existingName =
              typeof member.cleaningGroupName === 'string' ? member.cleaningGroupName : 'otro grupo';
            throw new HttpsError(
              'failed-precondition',
              `El usuario "${displayName}" ya pertenece a "${existingName}".`
            );
          }

          const memberActive = member.isActive === true;
          const eligible =
            typeof member.cleaningEligible === 'boolean' ? member.cleaningEligible : true;

          if (!memberActive || !eligible || memberIds.includes(memberId)) return;

          memberIds.push(memberId);
          transaction.update(memberRef, {
            cleaningGroupId: groupRef.id,
            cleaningGroupName: payload.name,
            updatedAt: now,
          });
        });
      }

      transaction.set(groupRef, {
        name: payload.name,
        description: payload.description,
        congregationId: requesterCongregationId,
        groupType: payload.groupType,
        memberIds,
        memberCount: memberIds.length,
        isActive: payload.isActive,
        createdBy: uid,
        createdAt: now,
        updatedAt: now,
      });
    });

    return { groupId: groupRef.id };
  }
);

type AddCleaningGroupMembersPayload = {
  congregationId: string;
  groupId: string;
  userIds: string[];
};

const parseAddCleaningGroupMembersPayload = (
  raw: unknown
): AddCleaningGroupMembersPayload => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new HttpsError('invalid-argument', 'Payload invalido.');
  }

  const data = raw as Record<string, unknown>;
  const congregationId =
    typeof data.congregationId === 'string' ? data.congregationId.trim() : '';
  const groupId = typeof data.groupId === 'string' ? data.groupId.trim() : '';
  const userIds = Array.isArray(data.userIds)
    ? data.userIds.filter(
        (value): value is string => typeof value === 'string' && value.length > 0
      )
    : [];

  if (!congregationId) {
    throw new HttpsError('invalid-argument', 'congregationId es requerido.');
  }
  if (!groupId) {
    throw new HttpsError('invalid-argument', 'groupId es requerido.');
  }
  return { congregationId, groupId, userIds };
};

export const addCleaningGroupMembersByManager = onCall(
  { region: 'us-central1' },
  async (request): Promise<{ added: number; skipped: number }> => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const db = getFirestore();
    const requesterSnap = await db.collection('users').doc(uid).get();

    if (!requesterSnap.exists) {
      throw new HttpsError('permission-denied', 'No se encontro el perfil del usuario.');
    }

    const requester = requesterSnap.data() as Record<string, unknown>;
    const requesterCongregationId =
      typeof requester.congregationId === 'string' ? requester.congregationId : '';

    if (requester.isActive !== true || !requesterCongregationId) {
      throw new HttpsError('permission-denied', 'No tienes permisos para gestionar limpieza.');
    }

    const payload = parseAddCleaningGroupMembersPayload(request.data);

    if (payload.congregationId !== requesterCongregationId) {
      throw new HttpsError('permission-denied', 'No puedes gestionar grupos de otra congregacion.');
    }

    await assertAdministrativeBillingAccess(requesterCongregationId);

    if (!canManageCleaningFromProfile(requester)) {
      throw new HttpsError('permission-denied', 'No tienes permisos para gestionar limpieza.');
    }

    if (payload.userIds.length > MAX_CLEANING_MEMBERS) {
      throw new HttpsError(
        'invalid-argument',
        `Un grupo no puede exceder ${MAX_CLEANING_MEMBERS} integrantes.`
      );
    }

    const candidateUserIds = Array.from(new Set(payload.userIds));

    const groupRefs = [
      db.collection('congregations')
        .doc(requesterCongregationId)
        .collection('cleaningGroups')
        .doc(payload.groupId),
      db.collection('congregations')
        .doc(requesterCongregationId)
        .collection('cleaning_groups')
        .doc(payload.groupId),
      db.collection('cleaningGroups').doc(payload.groupId),
      db.collection('cleaning_groups').doc(payload.groupId),
    ];
    const now = FieldValue.serverTimestamp();

    return db.runTransaction(async (transaction) => {
      const groupSnaps = await Promise.all(
        groupRefs.map((groupRef) => transaction.get(groupRef))
      );
      const groupIndex = groupSnaps.findIndex((snap) => snap.exists);

      if (groupIndex < 0) {
        throw new HttpsError('not-found', 'El grupo no existe.');
      }

      const groupRef = groupRefs[groupIndex];
      const groupSnap = groupSnaps[groupIndex];
      if (!groupRef || !groupSnap) {
        throw new HttpsError('not-found', 'El grupo no existe.');
      }

      const groupData = groupSnap.data() as Record<string, unknown>;
      const groupCongregationId =
        typeof groupData.congregationId === 'string' ? groupData.congregationId : '';

      if (groupCongregationId !== requesterCongregationId) {
        throw new HttpsError('permission-denied', 'No puedes gestionar grupos de otra congregacion.');
      }

      const currentMemberIds = Array.isArray(groupData.memberIds)
        ? groupData.memberIds.filter(
            (value): value is string => typeof value === 'string'
          )
        : [];
      const resolvedGroupName =
        typeof groupData.name === 'string' ? groupData.name : '';
      const userRefs = candidateUserIds.map((memberId) =>
        db.collection('users').doc(memberId)
      );
      const userSnaps = await Promise.all(
        userRefs.map((userRef) => transaction.get(userRef))
      );
      const newMemberIds = [...currentMemberIds];
      let added = 0;
      let skipped = 0;

      userSnaps.forEach((snap, index) => {
        const memberId = candidateUserIds[index];
        const memberRef = userRefs[index];

        if (!memberId || !memberRef || !snap.exists) {
          skipped += 1;
          return;
        }

        const member = snap.data() as Record<string, unknown>;
        const displayName =
          typeof member.displayName === 'string' ? member.displayName : memberId;
        const memberCongregationId =
          typeof member.congregationId === 'string' ? member.congregationId : '';

        if (memberCongregationId !== requesterCongregationId) {
          throw new HttpsError(
            'failed-precondition',
            `El usuario "${displayName}" no pertenece a la congregacion del grupo.`
          );
        }

        const existingGroupId =
          typeof member.cleaningGroupId === 'string' && member.cleaningGroupId.length > 0
            ? member.cleaningGroupId
            : null;

        if (existingGroupId && existingGroupId !== payload.groupId) {
          const existingName =
            typeof member.cleaningGroupName === 'string'
              ? member.cleaningGroupName
              : 'otro grupo';
          throw new HttpsError(
            'failed-precondition',
            `El usuario "${displayName}" ya pertenece a "${existingName}".`
          );
        }

        const memberActive = resolveCleaningMemberActive(member);
        const eligible =
          typeof member.cleaningEligible === 'boolean' ? member.cleaningEligible : true;

        if (!memberActive || !eligible || newMemberIds.includes(memberId)) {
          skipped += 1;
          return;
        }

        transaction.update(memberRef, {
          cleaningGroupId: payload.groupId,
          cleaningGroupName: resolvedGroupName,
          updatedAt: now,
        });
        newMemberIds.push(memberId);
        added += 1;
      });

      transaction.update(groupRef, {
        memberIds: newMemberIds,
        memberCount: newMemberIds.length,
        updatedAt: now,
      });

      return { added, skipped };
    });
  }
);
