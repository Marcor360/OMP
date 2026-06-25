import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from '@/src/lib/firebase/app';
import { sanitizeForFirestore } from '@/src/services/meetings/firestore-payload';
import type { CleaningScheduleRepository } from '@/src/services/repositories/ports/cleaning-schedule-repository.port';
import type {
  CleaningSchedule,
  CleaningScheduleItem,
} from '@/src/types/cleaning-schedule';

const schedulesRef = (congregationId: string) =>
  collection(db, 'congregations', congregationId, 'cleaningSchedules');

const scheduleItemsRef = (congregationId: string, scheduleId: string) =>
  collection(db, 'congregations', congregationId, 'cleaningSchedules', scheduleId, 'items');

const normalizeSchedule = (id: string, data: Record<string, unknown>): CleaningSchedule => ({
  id,
  congregationId: typeof data.congregationId === 'string' ? data.congregationId : '',
  title: typeof data.title === 'string' ? data.title : '',
  startDate: typeof data.startDate === 'string' ? data.startDate : '',
  endDate: typeof data.endDate === 'string' ? data.endDate : '',
  monthIds: Array.isArray(data.monthIds)
    ? data.monthIds.filter((item): item is string => typeof item === 'string')
    : [],
  totalMeetings: typeof data.totalMeetings === 'number' ? data.totalMeetings : 0,
  status:
    data.status === 'published' || data.status === 'archived' ? data.status : 'draft',
  createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
  updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
  createdAt: data.createdAt as CleaningSchedule['createdAt'],
  updatedAt: data.updatedAt as CleaningSchedule['updatedAt'],
  publishedAt: data.publishedAt as CleaningSchedule['publishedAt'],
});

const normalizeItem = (id: string, data: Record<string, unknown>): CleaningScheduleItem => ({
  id,
  congregationId: typeof data.congregationId === 'string' ? data.congregationId : '',
  scheduleId: typeof data.scheduleId === 'string' ? data.scheduleId : '',
  meetingId: typeof data.meetingId === 'string' ? data.meetingId : undefined,
  meetingDate: typeof data.meetingDate === 'string' ? data.meetingDate : '',
  meetingType: data.meetingType === 'midweek' ? 'midweek' : 'weekend',
  cleaningGroupId: typeof data.cleaningGroupId === 'string' ? data.cleaningGroupId : '',
  cleaningGroupName: typeof data.cleaningGroupName === 'string' ? data.cleaningGroupName : '',
  status:
    data.status === 'cancelled' || data.status === 'completed' ? data.status : 'scheduled',
  createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
  updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
  createdAt: data.createdAt as CleaningScheduleItem['createdAt'],
  updatedAt: data.updatedAt as CleaningScheduleItem['updatedAt'],
});

export const firestoreCleaningScheduleRepository: CleaningScheduleRepository = {
  listSchedules: async (congregationId: string): Promise<CleaningSchedule[]> => {
    const snap = await getDocs(
      query(schedulesRef(congregationId), where('status', 'in', ['draft', 'published']))
    );
    return snap.docs
      .map((docSnap) => normalizeSchedule(docSnap.id, docSnap.data()))
      .sort((l, r) => l.startDate.localeCompare(r.startDate));
  },

  listPublishedSchedules: async (congregationId: string): Promise<CleaningSchedule[]> => {
    const snap = await getDocs(
      query(schedulesRef(congregationId), where('status', '==', 'published'))
    );
    return snap.docs.map((docSnap) => normalizeSchedule(docSnap.id, docSnap.data()));
  },

  listScheduleItems: async (
    congregationId: string,
    scheduleId: string
  ): Promise<CleaningScheduleItem[]> => {
    const snap = await getDocs(scheduleItemsRef(congregationId, scheduleId));
    return snap.docs
      .map((docSnap) => normalizeItem(docSnap.id, docSnap.data()))
      .sort((l, r) => l.meetingDate.localeCompare(r.meetingDate));
  },

  listScheduledItemsForDateAndType: async (params: {
    congregationId: string;
    scheduleId: string;
    meetingDate: string;
    meetingType: 'midweek' | 'weekend';
  }): Promise<CleaningScheduleItem[]> => {
    const snap = await getDocs(
      query(
        scheduleItemsRef(params.congregationId, params.scheduleId),
        where('meetingDate', '==', params.meetingDate),
        where('meetingType', '==', params.meetingType),
        where('status', '==', 'scheduled')
      )
    );
    return snap.docs.map((docSnap) => normalizeItem(docSnap.id, docSnap.data()));
  },

  addSchedule: async (params: {
    congregationId: string;
    title: string;
    startDate: string;
    endDate: string;
    monthIds: string[];
    totalMeetings: number;
    actorUid: string;
  }): Promise<string> => {
    const ref = await addDoc(
      schedulesRef(params.congregationId),
      sanitizeForFirestore({
        congregationId: params.congregationId,
        title: params.title,
        startDate: params.startDate,
        endDate: params.endDate,
        monthIds: params.monthIds,
        totalMeetings: params.totalMeetings,
        status: 'draft',
        createdBy: params.actorUid,
        updatedBy: params.actorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    return ref.id;
  },

  upsertScheduleItems: async (params: {
    congregationId: string;
    scheduleId: string;
    items: Omit<CleaningScheduleItem, 'id' | 'createdAt' | 'updatedAt'>[];
    actorUid: string;
  }): Promise<void> => {
    const existingSnap = await getDocs(
      scheduleItemsRef(params.congregationId, params.scheduleId)
    );
    const existingById = new Map(
      existingSnap.docs.map((d) => [d.id, normalizeItem(d.id, d.data())])
    );
    const batch = writeBatch(db);

    params.items.forEach((item) => {
      const itemId = `${item.meetingDate}-${item.meetingType}-cleaning`;
      const ref = doc(scheduleItemsRef(params.congregationId, params.scheduleId), itemId);
      const existing = existingById.get(itemId);
      batch.set(ref, sanitizeForFirestore({
        ...item,
        congregationId: params.congregationId,
        scheduleId: params.scheduleId,
        createdBy: existing?.createdBy || item.createdBy || params.actorUid,
        updatedBy: params.actorUid,
        createdAt: existing?.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      }));
    });

    await batch.commit();
  },

  publishSchedule: async (params: {
    congregationId: string;
    scheduleId: string;
    syncMeetings?: boolean;
  }): Promise<{ syncedMeetings: number; missingMeetings: number }> => {
    const callable = httpsCallable<
      { congregationId: string; scheduleId: string; syncMeetings?: boolean },
      { ok: true; syncedMeetings: number; missingMeetings: number }
    >(functions, 'publishCleaningScheduleByManager');

    const result = await callable({
      congregationId: params.congregationId,
      scheduleId: params.scheduleId,
      syncMeetings: params.syncMeetings,
    });

    return {
      syncedMeetings: result.data.syncedMeetings,
      missingMeetings: result.data.missingMeetings,
    };
  },
};
