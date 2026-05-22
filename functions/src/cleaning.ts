import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

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
