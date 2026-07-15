import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from '@/src/lib/firebase/app';
import { sanitizeForFirestore } from '@/src/services/meetings/firestore-payload';
import type {
  EnsurePlanningMeetingsParams,
  EnsurePlanningMeetingsResult,
  HospitalityScheduleRepository,
} from '@/src/services/repositories/ports/hospitality-schedule-repository.port';
import type {
  HospitalityOptionalRoles,
  HospitalitySchedule,
  HospitalityScheduleItem,
} from '@/src/types/hospitality-microphones';

const schedulesRef = (congregationId: string) =>
  collection(db, 'congregations', congregationId, 'hospitalitySchedules');

const scheduleItemsRef = (congregationId: string, scheduleId: string) =>
  collection(db, 'congregations', congregationId, 'hospitalitySchedules', scheduleId, 'items');

const scheduleRef = (congregationId: string, scheduleId: string) =>
  doc(db, 'congregations', congregationId, 'hospitalitySchedules', scheduleId);

const normalizeOptionalRoles = (value: unknown): HospitalityOptionalRoles | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  return {
    microphoneThree: record.microphoneThree === true,
    attendantExtra: record.attendantExtra === true,
  };
};

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
  optionalRoles: normalizeOptionalRoles(data.optionalRoles),
});

const normalizeItem = (id: string, data: Record<string, unknown>): HospitalityScheduleItem => ({
  id,
  congregationId: typeof data.congregationId === 'string' ? data.congregationId : '',
  scheduleId: typeof data.scheduleId === 'string' ? data.scheduleId : '',
  meetingId: typeof data.meetingId === 'string' ? data.meetingId : undefined,
  meetingDate: typeof data.meetingDate === 'string' ? data.meetingDate : '',
  meetingType: data.meetingType === 'midweek' ? 'midweek' : 'weekend',
  roleKey:
    data.roleKey === 'chairman' ||
    data.roleKey === 'microphoneOne' ||
    data.roleKey === 'microphoneTwo' ||
    data.roleKey === 'microphoneThree' ||
    data.roleKey === 'attendantDoor' ||
    data.roleKey === 'attendantAuditorium' ||
    data.roleKey === 'attendantExtra' ||
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
  ensurePlanningMeetings: async (
    params: EnsurePlanningMeetingsParams
  ): Promise<EnsurePlanningMeetingsResult> => {
    const callable = httpsCallable<
      EnsurePlanningMeetingsParams,
      { ok: true } & EnsurePlanningMeetingsResult
    >(functions, 'ensurePlanningMeetingsByManager');
    const result = await callable(params);

    return {
      createdMidweek: result.data.createdMidweek,
      createdWeekend: result.data.createdWeekend,
      existing: result.data.existing,
    };
  },

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
    optionalRoles?: HospitalityOptionalRoles;
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
        optionalRoles: params.optionalRoles,
      })
    );
    return ref.id;
  },

  updateScheduleOptionalRoles: async (params: {
    congregationId: string;
    scheduleId: string;
    optionalRoles: HospitalityOptionalRoles;
    actorUid: string;
  }): Promise<void> => {
    await updateDoc(
      scheduleRef(params.congregationId, params.scheduleId),
      sanitizeForFirestore({
        optionalRoles: params.optionalRoles,
        updatedBy: params.actorUid,
        updatedAt: serverTimestamp(),
      })
    );
  },

  archiveSchedule: async (params: {
    congregationId: string;
    scheduleId: string;
    actorUid: string;
  }): Promise<void> => {
    await updateDoc(
      scheduleRef(params.congregationId, params.scheduleId),
      sanitizeForFirestore({
        status: 'archived',
        updatedBy: params.actorUid,
        updatedAt: serverTimestamp(),
      })
    );
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
    const incomingIds = new Set(
      params.items.map((item) => `${item.meetingDate}-${item.meetingType}-${item.roleKey}`)
    );

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

    existingSnap.docs.forEach((docSnap) => {
      const existing = existingById.get(docSnap.id);
      if (existing?.status === 'scheduled' && !incomingIds.has(docSnap.id)) {
        batch.update(docSnap.ref, {
          status: 'cancelled',
          updatedBy: params.actorUid,
          updatedAt: serverTimestamp(),
        });
      }
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

  substituteAssignment: async (params: {
    congregationId: string;
    scheduleId: string;
    itemId: string;
    newUserId: string;
  }): Promise<{ meetingSynced: boolean }> => {
    const callable = httpsCallable<
      { congregationId: string; scheduleId: string; itemId: string; newUserId: string },
      { ok: true; meetingSynced: boolean }
    >(functions, 'substituteHospitalityAssignmentByManager');

    const result = await callable(params);

    return { meetingSynced: result.data.meetingSynced };
  },
};
