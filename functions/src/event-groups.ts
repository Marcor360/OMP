import { FieldValue, type Transaction } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { adminDb } from './config/firebaseAdmin.js';
import { criticalCallableOptions } from './shared/callable-security.js';
import { EVENT_LIMITS, isEventId, type EventAudience, type EventPerson } from './shared/event-planning.js';
import { assertAdministrativeBillingAccess } from './users/authorization.js';

export async function readEventPeople(
  transaction: Transaction,
  congregationId: string,
  ids: string[]
): Promise<EventPerson[]> {
  if (!ids.length) return [];
  const profiles = await transaction.getAll(...ids.map((id) => adminDb.collection('users').doc(id)));
  return profiles.map((profile) => {
    const data = profile.data();
    const name = typeof data?.displayName === 'string' ? data.displayName.trim() : '';
    if (!data || data.congregationId !== congregationId || data.isActive !== true || !name) {
      throw new HttpsError('failed-precondition', 'Selecciona únicamente personas activas de tu congregación.');
    }
    return { uid: profile.id, name: name.slice(0, 160) };
  });
}

const groupsRef = (congregationId: string) =>
  adminDb.collection('congregations').doc(congregationId).collection('serviceGroups');

export async function readEventAudience(
  transaction: Transaction,
  congregationId: string,
  audience: EventAudience
): Promise<EventAudience & { name?: string; memberIds?: string[] }> {
  if (audience.kind === 'congregation') return { kind: 'congregation' };
  const id = audience.groupId;
  if (!isEventId(id)) throw new HttpsError('invalid-argument', 'Selecciona un grupo.');
  const congregation = adminDb.collection('congregations').doc(congregationId);
  const refs = audience.kind === 'service'
    ? [groupsRef(congregationId).doc(id)]
    : [
      congregation.collection('cleaningGroups').doc(id),
      congregation.collection('cleaning_groups').doc(id),
      adminDb.collection('cleaningGroups').doc(id),
      adminDb.collection('cleaning_groups').doc(id),
    ];
  // The canonical scoped group takes precedence over legacy copies.
  const matches = await transaction.getAll(...refs);
  const group = matches.find((snap, index) => {
    if (!snap.exists) return false;
    const scope = snap.get('congregationId');
    return scope === congregationId || (index < 2 && !scope);
  })?.data();
  if (!group || group.isActive === false || typeof group.name !== 'string'
    || (audience.kind === 'family' && group.groupType !== 'family')
    || (audience.kind === 'cleaning' && group.groupType === 'family')) {
    throw new HttpsError('failed-precondition', 'Selecciona un grupo activo de la categoría indicada.');
  }
  if (audience.kind === 'service') {
    const { superintendentId, assistantId } = group;
    if (!isEventId(superintendentId) || !isEventId(assistantId) || superintendentId === assistantId) {
      throw new HttpsError('failed-precondition', 'El grupo necesita dos responsables distintos.');
    }
    await readEventPeople(transaction, congregationId, [superintendentId, assistantId]);
  }
  const memberIds: string[] = Array.isArray(group.memberIds) ? group.memberIds.filter(isEventId) : [];
  if (!memberIds.length) throw new HttpsError('failed-precondition', 'El grupo debe tener integrantes.');
  return { kind: audience.kind, groupId: id, name: group.name, memberIds: [...new Set(memberIds)] };
}

export const saveServiceGroupByAdmin = onCall(criticalCallableOptions, async (request): Promise<{ id: string }> => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  const { congregationId, id, name, superintendentId, assistantId, memberIds, isActive, expectedRevision } = request.data ?? {};
  if (!isEventId(congregationId) || !isEventId(id) || typeof name !== 'string'
    || !name.trim() || name.trim().length > 100 || !isEventId(superintendentId)
    || !isEventId(assistantId) || superintendentId === assistantId || !Array.isArray(memberIds)
    || memberIds.length > EVENT_LIMITS.people || !memberIds.every(isEventId) || typeof isActive !== 'boolean'
    || (expectedRevision !== undefined && (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision)))) {
    throw new HttpsError('invalid-argument', 'Indica un nombre y dos responsables distintos.');
  }
  const requester = (await adminDb.collection('users').doc(uid).get()).data();
  if (requester?.role !== 'admin' || requester.isActive !== true || requester.congregationId !== congregationId) {
    throw new HttpsError('permission-denied', 'Solo un administrador activo de la congregación puede modificar estos grupos.');
  }
  await assertAdministrativeBillingAccess(congregationId);
  const groupName = name.trim().replace(/\s+/g, ' ');
  const normalizedName = groupName.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const members = [...new Set<string>([superintendentId, assistantId, ...memberIds])].sort();
  if (members.length > EVENT_LIMITS.people) throw new HttpsError('invalid-argument', 'El grupo tiene demasiados integrantes.');
  const groups = groupsRef(congregationId);
  const ref = groups.doc(id);
  await adminDb.runTransaction(async (transaction) => {
    const existing = (await transaction.get(ref)).data();
    const samePeople = existing?.superintendentId === superintendentId && existing.assistantId === assistantId
      && JSON.stringify(existing.memberIds) === JSON.stringify(members);
    const same = samePeople && existing?.name === groupName && existing.isActive === isActive;
    if (same) return;
    if ((existing?.revision as number | undefined) !== expectedRevision) {
      throw new HttpsError('aborted', 'El grupo cambió. Vuelve a cargarlo antes de guardar.');
    }
    const duplicates = await transaction.get(groups.where('normalizedName', '==', normalizedName).limit(2));
    if (duplicates.docs.some((snap) => snap.id !== id)) {
      throw new HttpsError('already-exists', 'Ya existe un grupo de servicio con ese nombre.');
    }
    if (isActive || !samePeople) await readEventPeople(transaction, congregationId, members);
    transaction.set(ref, {
      name: groupName, normalizedName, congregationId, superintendentId, assistantId, memberIds: members, isActive,
      revision: (expectedRevision ?? 0) + 1, updatedAt: FieldValue.serverTimestamp(), updatedBy: uid,
      createdAt: existing?.createdAt ?? FieldValue.serverTimestamp(), createdBy: existing?.createdBy ?? uid,
    });
  });
  return { id };
});
