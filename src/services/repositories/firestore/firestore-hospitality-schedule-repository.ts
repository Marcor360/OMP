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
import type { HospitalityScheduleRepository } from '@/src/services/repositories/ports/hospitality-schedule-repository.port';
import type {
  HospitalitySchedule,
  HospitalityScheduleItem,
} from '@/src/types/hospitality-microphones';

const schedulesRef = (congregationId: string) =>
  collection(db, 'congregations', congregationId, 'hospitalitySchedules');

const scheduleItemsRef = (congregationId: string, scheduleId: string) =>
  collection(db, 'congregations', congregationId, 'hospitalitySchedules', scheduleId, 'items');

const normalizeSchedule = (id: string, data: Record<string, unknown>): HospitalitySchedule => ({
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
  createdAt: data.createdAt as HospitalitySchedule['createdAt'],
  updatedAt: data.updatedAt as HospitalitySchedule['updatedAt'],
  publishedAt: data.publishedAt as HospitalitySchedule['publishedAt'],
});

const normalizeItem = (id: string, data: Record<string, unknown>): HospitalityScheduleItem => ({
  id,
  congregationId: typeof data.congregationId === 'string' ? data.congregationId : '',
  scheduleId: typeof data.scheduleId === 'string' ? data.scheduleId : '',
  meetingId: typeof data.meetingId === 'string' ? data.meetingId : undefined,
  meetingDate: typeof data.meetingDate === 'string' ? data.meetingDate : '',
  meetingType: data.meetingType === 'midweek' ? 'midweek' : 'weekend',
  roleKey:
    data.roleKey === 'microphoneOne' ||
    data.roleKey === 'microphoneTwo' ||
    data.roleKey === 'attendantDoor' ||
    data.roleKey === 'attendantAuditorium' ||
    data.roleKey === 'watchtowerReader' ||
    data.roleKey === 'midweekBibleStudyReader' ||
    data.roleKey === 'audioVideo'
      ? data.roleKey
      : 'microphoneOne',
  roleLabel: typeof data.roleLabel === 'string' ? data.roleLabel : '',
  userId: typeof data.userId === 'string' ? data.userId : '',
  userNameSnapshot: typeof data.userNameSnapshot === 'string' ? data.userNameSnapshot : '',
  status:
    data.status === 'cancelled' || data.status === 'completed' ? data.status : 'scheduled',
  createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
  updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
  createdAt: data.createdAt as HospitalityScheduleItem['createdAt'],
  updatedAt: data.updatedAt as HospitalityScheduleItem['updatedAt'],
});

export const firestoreHospitalityScheduleRepository: HospitalityScheduleRepository = {
  listSchedules: async (congregationId: string): Promise<HospitalitySchedule[]> => {
    const snap = await getDocs(
      query(schedulesRef(congregationId), where('status', 'in', ['draft', 'published']))
    );
    return snap.docs
      .map((docSnap) => normalizeSchedule(docSnap.id, docSnap.data()))
      .sort((l, r) => l.startDate.localeCompare(r.startDate));
  },

  listPublishedSchedules: async (congregationId: string): Promise<HospitalitySchedule[]> => {
    const snap = await getDocs(
      query(schedulesRef(congregationId), where('status', '==', 'published'))
    );
    return snap.docs.map((docSnap) => normalizeSchedule(docSnap.id, docSnap.data()));
  },

  listScheduleItems: async (
    congregationId: string,
    scheduleId: string
  ): Promise<HospitalityScheduleItem[]> => {
    const snap = await getDocs(scheduleItemsRef(congregationId, scheduleId));
    return snap.docs
      .map((docSnap) => normalizeItem(docSnap.id, docSnap.data()))
      .sort(
        (l, r) =>
          l.meetingDate.localeCompare(r.meetingDate) || l.roleLabel.localeCompare(r.roleLabel)
      );
  },

  listScheduledItemsForDateAndType: async (params: {
    congregationId: string;
    scheduleId: string;
    meetingDate: string;
    meetingType: 'midweek' | 'weekend';
  }): Promise<HospitalityScheduleItem[]> => {
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
    items: Omit<HospitalityScheduleItem, 'id' | 'createdAt' | 'updatedAt'>[];
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
      const itemId = `${item.meetingDate}-${item.meetingType}-${item.roleKey}`;
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
    >(functions, 'publishHospitalityScheduleByManager');

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
