import { httpsCallable } from 'firebase/functions';

import { auth, functions } from '@/src/lib/firebase/app';
import { submitMeetingAssignment } from '@/src/services/repositories/firestore/firestore-assignment-repository';

import {
  markAssignmentConfirmed,
  readPendingAssignments,
  type AssignmentIntentScope,
  type AssignmentSaveIntent,
} from './pending-assignment-store';

const assertCurrentAccount = (scope: AssignmentIntentScope) => {
  if (auth.currentUser?.uid !== scope.uid) throw new Error('Account changed');
};

export const checkAssignmentIntent = async (
  scope: AssignmentIntentScope,
  { congregationId, meetingId, requestId }: AssignmentSaveIntent
): Promise<boolean> => {
  assertCurrentAccount(scope);
  if (scope.congregationId !== congregationId) throw new Error('Congregation changed');
  const callable = httpsCallable<
    { congregationId: string; meetingId: string; requestId: string; expectedActorUid: string },
    { saved: boolean }
  >(functions, 'getMeetingAssignmentSaveStatus', { timeout: 8_000 });
  const { data } = await callable({ congregationId, meetingId, requestId, expectedActorUid: scope.uid });
  assertCurrentAccount(scope);
  if (data.saved) await markAssignmentConfirmed(scope, requestId);
  return data.saved;
};

export const retryAssignmentIntent = async (scope: AssignmentIntentScope, intent: AssignmentSaveIntent) => {
  if (await checkAssignmentIntent(scope, intent)) return;
  assertCurrentAccount(scope);
  await submitMeetingAssignment({ ...intent, expectedActorUid: scope.uid });
  await markAssignmentConfirmed(scope, intent.requestId);
};

const inFlight = new Map<string, Promise<void>>();

export const reconcileAssignmentIntents = (scope: AssignmentIntentScope): Promise<void> => {
  const key = JSON.stringify([scope.uid, scope.congregationId]);
  const existing = inFlight.get(key);
  if (existing) return existing;
  const request = readPendingAssignments(scope).then(async (pending) => {
    const unchecked = pending.filter((record) => !record.confirmed);
    const failures: unknown[] = [];
    for (let start = 0; start < unchecked.length; start += 4) {
      assertCurrentAccount(scope);
      const batch = await Promise.allSettled(
        unchecked.slice(start, start + 4).map(({ intent }) => checkAssignmentIntent(scope, intent))
      );
      for (const result of batch) if (result.status === 'rejected') failures.push(result.reason);
    }
    if (failures.length > 0) throw failures[0];
  }).finally(() => { inFlight.delete(key); });
  inFlight.set(key, request);
  return request;
};
