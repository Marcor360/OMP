import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

import { adminDb } from '../config/firebaseAdmin.js';

export type UserDeletionReference = { kind: string; id: string; active: boolean };
export type UserDeletionPreflight = { active: UserDeletionReference[]; historical: UserDeletionReference[] };

const dateIsFutureOrUnknown = (data: Record<string, unknown>): boolean => {
  const status = typeof data.status === 'string' ? data.status : '';
  if (status === 'completed' || status === 'cancelled' || status === 'archived') return false;
  const date = typeof data.meetingDate === 'string' ? data.meetingDate : typeof data.date === 'string' ? data.date : '';
  return !date || date >= new Date().toISOString().slice(0, 10);
};

/** Reads only the target congregation and never deletes referenced history. */
export const classifyUserDeletionReferences = (references: UserDeletionReference[]): UserDeletionPreflight => ({
  active: references.filter((ref) => ref.active),
  historical: references.filter((ref) => !ref.active),
});

export const preflightUserDeletion = async (congregationId: string, uid: string): Promise<UserDeletionPreflight> => {
  const congregation = adminDb.collection('congregations').doc(congregationId);
  const [meetings, assignments, cleaning, talks, schedules] = await Promise.all([
    congregation.collection('meetings').where('assignedUserIds', 'array-contains', uid).get(),
    congregation.collection('assignments').where('assignedToUid', '==', uid).get(),
    congregation.collection('cleaningGroups').where('memberIds', 'array-contains', uid).get(),
    congregation.collection('outgoingTalks').where('speakerUserId', '==', uid).get(),
    congregation.collection('hospitalitySchedules').get(),
  ]);
  const refs: UserDeletionReference[] = [
    ...meetings.docs.map((doc) => ({ kind: 'meeting', id: doc.id, active: dateIsFutureOrUnknown(doc.data()) })),
    ...assignments.docs.map((doc) => ({ kind: 'assignment', id: doc.id, active: dateIsFutureOrUnknown(doc.data()) })),
    ...cleaning.docs.map((doc) => ({ kind: 'cleaningGroup', id: doc.id, active: doc.data().isActive !== false })),
    ...talks.docs.map((doc) => ({ kind: 'outgoingTalk', id: doc.id, active: doc.data().status === 'scheduled' })),
    ...schedules.docs.flatMap((doc) => {
      const items = Array.isArray(doc.data().items) ? doc.data().items as Record<string, unknown>[] : [];
      return items.filter((item) => item?.userId === uid).map((item) => ({
        kind: 'hospitalitySchedule', id: `${doc.id}:${String(item.meetingId ?? item.roleKey ?? 'item')}`,
        active: typeof item.meetingDate !== 'string' || item.meetingDate >= new Date().toISOString().slice(0, 10),
      }));
    }),
  ];
  return classifyUserDeletionReferences(refs);
};

const authNotFound = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && String(error.code) === 'auth/user-not-found';

export const executeUserHardDelete = async (params: {
  uid: string; congregationId: string; requesterUid: string; wasActive: boolean;
}): Promise<{ alreadyDeleted: boolean }> => {
  const profileRef = adminDb.collection('users').doc(params.uid);
  const profile = await profileRef.get();
  if (!profile.exists) {
    try { await getAuth().deleteUser(params.uid); } catch (error) { if (!authNotFound(error)) throw error; }
    return { alreadyDeleted: true };
  }
  try { await getAuth().updateUser(params.uid, { disabled: true }); } catch (error) { if (!authNotFound(error)) throw error; }
  await adminDb.recursiveDelete(profileRef);
  try { await getAuth().deleteUser(params.uid); } catch (error) { if (!authNotFound(error)) throw error; }
  await adminDb.collection('congregations').doc(params.congregationId).collection('changeLogs').doc(`user-delete-${params.uid}`).set({
    action: 'user_deleted', uid: params.uid, congregationId: params.congregationId, performedBy: params.requesterUid,
    performedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  logger.info('User hard delete completed', { uid: params.uid, congregationId: params.congregationId });
  return { alreadyDeleted: false };
};
