import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  MAX_CLEANING_MEMBERS,
  canManageCleaningFromProfile,
  exceedsCleaningMemberLimit,
  resolveCleaningMemberOutcome,
  resolveExistingCleaningGroupIndex,
} from './shared/cleaning-access.js';
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
      const groupIndex = resolveExistingCleaningGroupIndex(
        groupSnaps.map((snap) => snap.exists)
      );

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
        ? Array.from(
            new Set(
              groupData.memberIds.filter(
                (value): value is string => typeof value === 'string'
              )
            )
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
        const outcome = resolveCleaningMemberOutcome(
          memberId,
          member,
          requesterCongregationId,
          payload.groupId,
          newMemberIds
        );

        if (outcome.kind === 'error') {
          throw new HttpsError('failed-precondition', outcome.message);
        }
        if (outcome.kind === 'skipped') {
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

      if (exceedsCleaningMemberLimit(newMemberIds)) {
        throw new HttpsError(
          'failed-precondition',
          `Un grupo no puede exceder ${MAX_CLEANING_MEMBERS} integrantes.`
        );
      }

      transaction.update(groupRef, {
        memberIds: newMemberIds,
        memberCount: newMemberIds.length,
        updatedAt: now,
      });

      return { added, skipped };
    });
  }
);

type CleaningGroupMutationPayload = {
  congregationId: string;
  groupId: string;
  userId: string;
};

const parseCleaningGroupMutationPayload = (
  raw: unknown,
  requireUserId = false
): CleaningGroupMutationPayload => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new HttpsError('invalid-argument', 'Payload invalido.');
  }

  const data = raw as Record<string, unknown>;
  const congregationId =
    typeof data.congregationId === 'string' ? data.congregationId.trim() : '';
  const groupId = typeof data.groupId === 'string' ? data.groupId.trim() : '';
  const userId = typeof data.userId === 'string' ? data.userId.trim() : '';

  if (!congregationId) {
    throw new HttpsError('invalid-argument', 'congregationId es requerido.');
  }
  if (!groupId) {
    throw new HttpsError('invalid-argument', 'groupId es requerido.');
  }
  if (requireUserId && !userId) {
    throw new HttpsError('invalid-argument', 'userId es requerido.');
  }

  return { congregationId, groupId, userId };
};

const cleaningGroupRefs = (
  db: FirebaseFirestore.Firestore,
  congregationId: string,
  groupId: string
) => [
  db.collection('congregations')
    .doc(congregationId)
    .collection('cleaningGroups')
    .doc(groupId),
  db.collection('congregations')
    .doc(congregationId)
    .collection('cleaning_groups')
    .doc(groupId),
  db.collection('cleaningGroups').doc(groupId),
  db.collection('cleaning_groups').doc(groupId),
];

const loadCleaningManagerContext = async (
  uid: string,
  requestedCongregationId: string
): Promise<{ db: FirebaseFirestore.Firestore; congregationId: string }> => {
  const db = getFirestore();
  const requesterSnap = await db.collection('users').doc(uid).get();

  if (!requesterSnap.exists) {
    throw new HttpsError('permission-denied', 'No se encontro el perfil del usuario.');
  }

  const requester = requesterSnap.data() as Record<string, unknown>;
  const congregationId =
    typeof requester.congregationId === 'string' ? requester.congregationId : '';

  if (requester.isActive !== true || !congregationId) {
    throw new HttpsError('permission-denied', 'No tienes permisos para gestionar limpieza.');
  }
  if (requestedCongregationId !== congregationId) {
    throw new HttpsError('permission-denied', 'No puedes gestionar grupos de otra congregacion.');
  }

  await assertAdministrativeBillingAccess(congregationId);

  if (!canManageCleaningFromProfile(requester)) {
    throw new HttpsError('permission-denied', 'No tienes permisos para gestionar limpieza.');
  }

  return { db, congregationId };
};

export const removeCleaningGroupMemberByManager = onCall(
  { region: 'us-central1' },
  async (request): Promise<{ removed: true }> => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = parseCleaningGroupMutationPayload(request.data, true);
    const { db, congregationId } = await loadCleaningManagerContext(
      uid,
      payload.congregationId
    );
    const groupRefs = cleaningGroupRefs(db, congregationId, payload.groupId);
    const userRef = db.collection('users').doc(payload.userId);
    const now = FieldValue.serverTimestamp();

    await db.runTransaction(async (transaction) => {
      const groupSnaps = await Promise.all(groupRefs.map((ref) => transaction.get(ref)));
      const groupIndex = resolveExistingCleaningGroupIndex(
        groupSnaps.map((snap) => snap.exists)
      );
      if (groupIndex < 0) {
        throw new HttpsError('not-found', 'El grupo no existe.');
      }

      const groupRef = groupRefs[groupIndex];
      const groupSnap = groupSnaps[groupIndex];
      if (!groupRef || !groupSnap) {
        throw new HttpsError('not-found', 'El grupo no existe.');
      }

      const groupData = groupSnap.data() as Record<string, unknown>;
      if (groupData.congregationId !== congregationId) {
        throw new HttpsError('permission-denied', 'No puedes gestionar grupos de otra congregacion.');
      }

      const currentMemberIds = Array.isArray(groupData.memberIds)
        ? groupData.memberIds.filter((value): value is string => typeof value === 'string')
        : [];
      if (!currentMemberIds.includes(payload.userId)) {
        throw new HttpsError('failed-precondition', 'El usuario no pertenece a este grupo.');
      }

      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) {
        throw new HttpsError('failed-precondition', 'El usuario no existe.');
      }
      const userData = userSnap.data() as Record<string, unknown>;
      if (userData.congregationId !== congregationId) {
        throw new HttpsError('failed-precondition', 'El usuario no pertenece a la congregacion.');
      }
      if (
        typeof userData.cleaningGroupId === 'string' &&
        userData.cleaningGroupId.length > 0 &&
        userData.cleaningGroupId !== payload.groupId
      ) {
        throw new HttpsError('failed-precondition', 'El usuario pertenece a otro grupo.');
      }

      const newMemberIds = currentMemberIds.filter((memberId) => memberId !== payload.userId);
      transaction.update(userRef, {
        cleaningGroupId: null,
        cleaningGroupName: null,
        updatedAt: now,
      });
      transaction.update(groupRef, {
        memberIds: newMemberIds,
        memberCount: newMemberIds.length,
        updatedAt: now,
      });
    });

    return { removed: true };
  }
);

export const deleteCleaningGroupByManager = onCall(
  { region: 'us-central1' },
  async (request): Promise<{ deleted: true; released: number }> => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = parseCleaningGroupMutationPayload(request.data);
    const { db, congregationId } = await loadCleaningManagerContext(
      uid,
      payload.congregationId
    );
    const groupRefs = cleaningGroupRefs(db, congregationId, payload.groupId);
    const now = FieldValue.serverTimestamp();

    return db.runTransaction(async (transaction) => {
      const groupSnaps = await Promise.all(groupRefs.map((ref) => transaction.get(ref)));
      const groupIndex = resolveExistingCleaningGroupIndex(
        groupSnaps.map((snap) => snap.exists)
      );
      if (groupIndex < 0) {
        throw new HttpsError('not-found', 'El grupo no existe.');
      }

      const groupRef = groupRefs[groupIndex];
      const groupSnap = groupSnaps[groupIndex];
      if (!groupRef || !groupSnap) {
        throw new HttpsError('not-found', 'El grupo no existe.');
      }

      const groupData = groupSnap.data() as Record<string, unknown>;
      if (groupData.congregationId !== congregationId) {
        throw new HttpsError('permission-denied', 'No puedes gestionar grupos de otra congregacion.');
      }

      const memberIds = Array.isArray(groupData.memberIds)
        ? Array.from(
            new Set(
              groupData.memberIds.filter(
                (value): value is string => typeof value === 'string' && value.length > 0
              )
            )
          )
        : [];
      const memberRefs = memberIds.map((memberId) => db.collection('users').doc(memberId));
      const memberSnaps = await Promise.all(
        memberRefs.map((memberRef) => transaction.get(memberRef))
      );

      memberSnaps.forEach((memberSnap, index) => {
        const memberRef = memberRefs[index];
        if (!memberRef || !memberSnap.exists) return;

        const member = memberSnap.data() as Record<string, unknown>;
        if (member.congregationId !== congregationId) {
          throw new HttpsError(
            'failed-precondition',
            'El grupo contiene un usuario de otra congregacion.'
          );
        }

        if (member.cleaningGroupId === payload.groupId) {
          transaction.update(memberRef, {
            cleaningGroupId: null,
            cleaningGroupName: null,
            updatedAt: now,
          });
        }
      });

      transaction.delete(groupRef);
      return {
        deleted: true,
        released: memberSnaps.filter(
          (snap) => snap.exists && snap.data()?.cleaningGroupId === payload.groupId
        ).length,
      };
    });
  }
);

export const deactivateCleaningGroupByManager = onCall(
  { region: 'us-central1' },
  async (request): Promise<{ deactivated: true; released: number }> => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = parseCleaningGroupMutationPayload(request.data);
    const { db, congregationId } = await loadCleaningManagerContext(
      uid,
      payload.congregationId
    );
    const groupRefs = cleaningGroupRefs(db, congregationId, payload.groupId);
    const now = FieldValue.serverTimestamp();

    return db.runTransaction(async (transaction) => {
      const groupSnaps = await Promise.all(groupRefs.map((ref) => transaction.get(ref)));
      const groupIndex = resolveExistingCleaningGroupIndex(
        groupSnaps.map((snap) => snap.exists)
      );
      if (groupIndex < 0) {
        throw new HttpsError('not-found', 'El grupo no existe.');
      }

      const groupRef = groupRefs[groupIndex];
      const groupSnap = groupSnaps[groupIndex];
      if (!groupRef || !groupSnap) {
        throw new HttpsError('not-found', 'El grupo no existe.');
      }

      const groupData = groupSnap.data() as Record<string, unknown>;
      if (groupData.congregationId !== congregationId) {
        throw new HttpsError('permission-denied', 'No puedes gestionar grupos de otra congregacion.');
      }

      const memberIds = Array.isArray(groupData.memberIds)
        ? Array.from(
            new Set(
              groupData.memberIds.filter(
                (value): value is string => typeof value === 'string' && value.length > 0
              )
            )
          )
        : [];
      const memberRefs = memberIds.map((memberId) => db.collection('users').doc(memberId));
      const memberSnaps = await Promise.all(
        memberRefs.map((memberRef) => transaction.get(memberRef))
      );

      memberSnaps.forEach((memberSnap, index) => {
        const memberRef = memberRefs[index];
        if (!memberRef || !memberSnap.exists) return;

        const member = memberSnap.data() as Record<string, unknown>;
        if (member.congregationId !== congregationId) {
          throw new HttpsError(
            'failed-precondition',
            'El grupo contiene un usuario de otra congregacion.'
          );
        }

        if (member.cleaningGroupId === payload.groupId) {
          transaction.update(memberRef, {
            cleaningGroupId: null,
            cleaningGroupName: null,
            updatedAt: now,
          });
        }
      });

      transaction.update(groupRef, {
        isActive: false,
        memberIds: [],
        memberCount: 0,
        updatedAt: now,
      });
      return {
        deactivated: true,
        released: memberSnaps.filter(
          (snap) => snap.exists && snap.data()?.cleaningGroupId === payload.groupId
        ).length,
      };
    });
  }
);
