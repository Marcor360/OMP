import {
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { functions } from '@/src/lib/firebase/app';
import { outgoingTalksCollectionRef } from '@/src/lib/firebase/refs';
import {
  OutgoingTalk,
  OutgoingTalkFormPayload,
  OutgoingTalkStatus,
} from '@/src/modules/assignments/types/outgoing-talks.types';
import { resolveOutgoingTalkWeekRange } from '@/src/modules/assignments/utils/outgoing-talks';
import { clearSessionCacheByPrefix } from '@/src/services/repositories/session-cache';

const normalizeOutgoingTalkStatus = (value: unknown): OutgoingTalkStatus => {
  if (value === 'cancelled' || value === 'completed') return value;
  return 'scheduled';
};

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeOutgoingTalk = (id: string, data: Record<string, unknown>): OutgoingTalk => ({
  id,
  congregationId: normalizeText(data.congregationId) ?? '',
  speakerUserId: normalizeText(data.speakerUserId) ?? '',
  speakerName: normalizeText(data.speakerName) ?? 'Sin nombre',
  destinationCongregationName: normalizeText(data.destinationCongregationName) ?? '',
  talkDate: normalizeText(data.talkDate) ?? '',
  talkTime: normalizeText(data.talkTime) ?? '',
  weekStartDate: normalizeText(data.weekStartDate) ?? '',
  weekEndDate: normalizeText(data.weekEndDate) ?? '',
  status: normalizeOutgoingTalkStatus(data.status),
  notes: normalizeText(data.notes),
  createdBy: normalizeText(data.createdBy) ?? '',
  updatedBy: normalizeText(data.updatedBy),
  createdAt: data.createdAt as OutgoingTalk['createdAt'],
  updatedAt: data.updatedAt as OutgoingTalk['updatedAt'],
});

const sortOutgoingTalks = (items: OutgoingTalk[]): OutgoingTalk[] =>
  [...items].sort((left, right) => {
    const byDate = left.talkDate.localeCompare(right.talkDate);
    return byDate !== 0 ? byDate : left.talkTime.localeCompare(right.talkTime);
  });

const callOutgoingTalkFunction = async <TResponse>(
  name: string,
  payload: OutgoingTalkFormPayload
): Promise<TResponse> => {
  const callable = httpsCallable<OutgoingTalkFormPayload, TResponse>(functions, name);
  const result = await callable(payload);
  clearSessionCacheByPrefix(`query:outgoingTalks/${payload.congregationId}/`);
  return result.data;
};

export const subscribeToOutgoingTalks = (
  congregationId: string,
  callback: (items: OutgoingTalk[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe => {
  const q = query(
    outgoingTalksCollectionRef(congregationId),
    orderBy('talkDate', 'asc'),
    orderBy('talkTime', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      callback(sortOutgoingTalks(snapshot.docs.map((doc) => normalizeOutgoingTalk(doc.id, doc.data()))));
    },
    onError
  );
};

export const getScheduledOutgoingTalksForWeek = async (
  congregationId: string,
  assignmentDate: Date | string
): Promise<OutgoingTalk[]> => {
  if (!congregationId) return [];
  const { weekStartDate } = resolveOutgoingTalkWeekRange(
    typeof assignmentDate === 'string'
      ? assignmentDate
      : `${assignmentDate.getFullYear()}-${String(assignmentDate.getMonth() + 1).padStart(2, '0')}-${String(assignmentDate.getDate()).padStart(2, '0')}`
  );

  const q = query(
    outgoingTalksCollectionRef(congregationId),
    where('status', '==', 'scheduled'),
    where('weekStartDate', '==', weekStartDate)
  );
  const snapshot = await getDocs(q);
  return sortOutgoingTalks(snapshot.docs.map((doc) => normalizeOutgoingTalk(doc.id, doc.data())));
};

export const getScheduledOutgoingTalksInRange = async (
  congregationId: string,
  startDate: string,
  endDate: string
): Promise<OutgoingTalk[]> => {
  if (!congregationId || !startDate || !endDate || startDate > endDate) return [];
  const startWeek = resolveOutgoingTalkWeekRange(startDate).weekStartDate;
  const endWeek = resolveOutgoingTalkWeekRange(endDate).weekStartDate;
  const q = query(
    outgoingTalksCollectionRef(congregationId),
    where('status', '==', 'scheduled'),
    where('weekStartDate', '>=', startWeek),
    where('weekStartDate', '<=', endWeek)
  );
  const snapshot = await getDocs(q);
  return sortOutgoingTalks(snapshot.docs.map((doc) => normalizeOutgoingTalk(doc.id, doc.data())));
};

export const createOutgoingTalkByManager = (payload: OutgoingTalkFormPayload): Promise<{ outgoingTalkId: string }> =>
  callOutgoingTalkFunction('createOutgoingTalkByManager', payload);

export const updateOutgoingTalkByManager = (payload: OutgoingTalkFormPayload): Promise<{ ok: true }> =>
  callOutgoingTalkFunction('updateOutgoingTalkByManager', payload);

export const cancelOutgoingTalkByManager = (payload: OutgoingTalkFormPayload): Promise<{ ok: true }> =>
  callOutgoingTalkFunction('cancelOutgoingTalkByManager', payload);

export const completeOutgoingTalkByManager = (payload: OutgoingTalkFormPayload): Promise<{ ok: true }> =>
  callOutgoingTalkFunction('completeOutgoingTalkByManager', payload);
