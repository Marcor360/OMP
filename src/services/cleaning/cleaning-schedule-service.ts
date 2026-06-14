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
import {
  buildPlanningWindow,
  validatePlanningWindow,
} from '@/src/services/planning/operational-planning-service';
import { validateNoPublishedScheduleOverlap } from '@/src/services/planning/planning-conflict-service';
import {
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

const getPublishedSchedules = async (congregationId: string): Promise<CleaningSchedule[]> => {
  const snap = await getDocs(
    query(schedulesRef(congregationId), where('status', '==', 'published'))
  );
  return snap.docs.map((docSnap) => normalizeSchedule(docSnap.id, docSnap.data()));
};

export const getCleaningSchedules = async (
  congregationId: string
): Promise<CleaningSchedule[]> => {
  if (!congregationId) return [];

  const snap = await getDocs(
    query(schedulesRef(congregationId), where('status', 'in', ['draft', 'published']))
  );
  return snap.docs
    .map((docSnap) => normalizeSchedule(docSnap.id, docSnap.data()))
    .sort((left, right) => left.startDate.localeCompare(right.startDate));
};

export const getCleaningScheduleItems = async (params: {
  congregationId: string;
  scheduleId: string;
}): Promise<CleaningScheduleItem[]> => {
  if (!params.congregationId || !params.scheduleId) return [];

  const snap = await getDocs(scheduleItemsRef(params.congregationId, params.scheduleId));
  return snap.docs
    .map((docSnap) => normalizeItem(docSnap.id, docSnap.data()))
    .sort((left, right) => left.meetingDate.localeCompare(right.meetingDate));
};

export const getCleaningAssignmentsForMeetingDate = async (params: {
  congregationId: string;
  meetingDate: string;
  meetingType: 'midweek' | 'weekend';
}): Promise<CleaningScheduleItem[]> => {
  if (!params.congregationId || !params.meetingDate) return [];

  const schedules = await getPublishedSchedules(params.congregationId);
  const matchingSchedules = schedules.filter(
    (schedule) => schedule.startDate <= params.meetingDate && schedule.endDate >= params.meetingDate
  );
  const results = await Promise.all(
    matchingSchedules.map(async (schedule) => {
      const itemsSnap = await getDocs(
        query(
          scheduleItemsRef(params.congregationId, schedule.id),
          where('meetingDate', '==', params.meetingDate),
          where('meetingType', '==', params.meetingType),
          where('status', '==', 'scheduled')
        )
      );

      return itemsSnap.docs.map((itemDoc) => normalizeItem(itemDoc.id, itemDoc.data()));
    })
  );

  return results.flat();
};

export const createCleaningSchedule = async (params: {
  congregationId: string;
  title: string;
  startDate: Date;
  endDate: Date;
  totalMeetings: number;
  actorUid: string;
}): Promise<string> => {
  const validation = validatePlanningWindow({
    startDate: params.startDate,
    endDate: params.endDate,
    module: 'cleaning',
  });

  if (!validation.ok) {
    throw new Error(validation.errors.join('\n'));
  }

  const window = buildPlanningWindow(params.startDate, params.endDate);
  const payload = sanitizeForFirestore({
    congregationId: params.congregationId,
    title: params.title.trim(),
    startDate: window.startDate,
    endDate: window.endDate,
    monthIds: window.monthIds,
    totalMeetings: params.totalMeetings,
    status: 'draft',
    createdBy: params.actorUid,
    updatedBy: params.actorUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const ref = await addDoc(schedulesRef(params.congregationId), payload);
  return ref.id;
};

export const saveCleaningScheduleItems = async (params: {
  congregationId: string;
  scheduleId: string;
  items: Omit<CleaningScheduleItem, 'id' | 'createdAt' | 'updatedAt'>[];
  actorUid: string;
}): Promise<void> => {
  const existingItems = await getCleaningScheduleItems({
    congregationId: params.congregationId,
    scheduleId: params.scheduleId,
  });
  const existingById = new Map(existingItems.map((item) => [item.id, item]));
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
};

export const publishCleaningSchedule = async (params: {
  congregationId: string;
  scheduleId: string;
  actorUid: string;
  startDate: string;
  endDate: string;
  syncMeetings?: boolean;
}): Promise<{ syncedMeetings: number; missingMeetings: number }> => {
  const existingSchedules = await getPublishedSchedules(params.congregationId);
  const overlap = validateNoPublishedScheduleOverlap({
    window: { startDate: params.startDate, endDate: params.endDate },
    schedules: existingSchedules,
    excludeScheduleId: params.scheduleId,
    moduleLabel: 'limpieza',
  });

  if (!overlap.ok) {
    throw new Error(overlap.errors.join('\n'));
  }

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
};
