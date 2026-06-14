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
import {
  buildPlanningWindow,
  validatePlanningWindow,
} from '@/src/services/planning/operational-planning-service';
import { validateNoPublishedScheduleOverlap } from '@/src/services/planning/planning-conflict-service';
import { sanitizeForFirestore } from '@/src/services/meetings/firestore-payload';
import {
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

const getPublishedSchedules = async (congregationId: string): Promise<HospitalitySchedule[]> => {
  const snap = await getDocs(
    query(schedulesRef(congregationId), where('status', '==', 'published'))
  );
  return snap.docs.map((docSnap) => normalizeSchedule(docSnap.id, docSnap.data()));
};

export const getHospitalitySchedules = async (
  congregationId: string
): Promise<HospitalitySchedule[]> => {
  if (!congregationId) return [];

  const snap = await getDocs(
    query(schedulesRef(congregationId), where('status', 'in', ['draft', 'published']))
  );
  return snap.docs
    .map((docSnap) => normalizeSchedule(docSnap.id, docSnap.data()))
    .sort((left, right) => left.startDate.localeCompare(right.startDate));
};

export const getHospitalityScheduleItems = async (params: {
  congregationId: string;
  scheduleId: string;
}): Promise<HospitalityScheduleItem[]> => {
  if (!params.congregationId || !params.scheduleId) return [];

  const snap = await getDocs(scheduleItemsRef(params.congregationId, params.scheduleId));
  return snap.docs
    .map((docSnap) => normalizeItem(docSnap.id, docSnap.data()))
    .sort((left, right) => (
      left.meetingDate.localeCompare(right.meetingDate) ||
      left.roleLabel.localeCompare(right.roleLabel)
    ));
};

export const getHospitalityAssignmentsForMeetingDate = async (params: {
  congregationId: string;
  meetingDate: string;
  meetingType: 'midweek' | 'weekend';
}): Promise<HospitalityScheduleItem[]> => {
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

export const createHospitalitySchedule = async (params: {
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
    module: 'hospitalityMicrophones',
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

export const saveHospitalityScheduleItems = async (params: {
  congregationId: string;
  scheduleId: string;
  items: Omit<HospitalityScheduleItem, 'id' | 'createdAt' | 'updatedAt'>[];
  actorUid: string;
}): Promise<void> => {
  const existingItems = await getHospitalityScheduleItems({
    congregationId: params.congregationId,
    scheduleId: params.scheduleId,
  });
  const existingById = new Map(existingItems.map((item) => [item.id, item]));
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
};

export const publishHospitalitySchedule = async (params: {
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
    moduleLabel: 'acomodadores y microfonos',
  });

  if (!overlap.ok) {
    throw new Error(overlap.errors.join('\n'));
  }

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
};
