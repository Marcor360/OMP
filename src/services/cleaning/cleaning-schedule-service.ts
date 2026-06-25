import { firestoreCleaningScheduleRepository } from '@/src/services/repositories/firestore/firestore-cleaning-schedule-repository';
import type { CleaningScheduleRepository } from '@/src/services/repositories/ports/cleaning-schedule-repository.port';
import {
  buildPlanningWindow,
  validatePlanningWindow,
} from '@/src/services/planning/operational-planning-service';
import { validateNoPublishedScheduleOverlap } from '@/src/services/planning/planning-conflict-service';
import type {
  CleaningSchedule,
  CleaningScheduleItem,
} from '@/src/types/cleaning-schedule';

let cleaningScheduleRepository: CleaningScheduleRepository = firestoreCleaningScheduleRepository;

export const __setCleaningScheduleRepositoryForTests = (repo: CleaningScheduleRepository): void => {
  cleaningScheduleRepository = repo;
};

export const __resetCleaningScheduleRepositoryForTests = (): void => {
  cleaningScheduleRepository = firestoreCleaningScheduleRepository;
};

export const getCleaningSchedules = async (
  congregationId: string
): Promise<CleaningSchedule[]> => {
  if (!congregationId) return [];
  return cleaningScheduleRepository.listSchedules(congregationId);
};

export const getCleaningScheduleItems = async (params: {
  congregationId: string;
  scheduleId: string;
}): Promise<CleaningScheduleItem[]> => {
  if (!params.congregationId || !params.scheduleId) return [];
  return cleaningScheduleRepository.listScheduleItems(params.congregationId, params.scheduleId);
};

export const getCleaningAssignmentsForMeetingDate = async (params: {
  congregationId: string;
  meetingDate: string;
  meetingType: 'midweek' | 'weekend';
}): Promise<CleaningScheduleItem[]> => {
  if (!params.congregationId || !params.meetingDate) return [];

  const schedules = await cleaningScheduleRepository.listPublishedSchedules(params.congregationId);
  const matchingSchedules = schedules.filter(
    (schedule) => schedule.startDate <= params.meetingDate && schedule.endDate >= params.meetingDate
  );
  const results = await Promise.all(
    matchingSchedules.map((schedule) =>
      cleaningScheduleRepository.listScheduledItemsForDateAndType({
        congregationId: params.congregationId,
        scheduleId: schedule.id,
        meetingDate: params.meetingDate,
        meetingType: params.meetingType,
      })
    )
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
  return cleaningScheduleRepository.addSchedule({
    congregationId: params.congregationId,
    title: params.title.trim(),
    startDate: window.startDate,
    endDate: window.endDate,
    monthIds: window.monthIds,
    totalMeetings: params.totalMeetings,
    actorUid: params.actorUid,
  });
};

export const saveCleaningScheduleItems = async (params: {
  congregationId: string;
  scheduleId: string;
  items: Omit<CleaningScheduleItem, 'id' | 'createdAt' | 'updatedAt'>[];
  actorUid: string;
}): Promise<void> => {
  return cleaningScheduleRepository.upsertScheduleItems(params);
};

export const publishCleaningSchedule = async (params: {
  congregationId: string;
  scheduleId: string;
  actorUid: string;
  startDate: string;
  endDate: string;
  syncMeetings?: boolean;
}): Promise<{ syncedMeetings: number; missingMeetings: number }> => {
  const existingSchedules = await cleaningScheduleRepository.listPublishedSchedules(
    params.congregationId
  );
  const overlap = validateNoPublishedScheduleOverlap({
    window: { startDate: params.startDate, endDate: params.endDate },
    schedules: existingSchedules,
    excludeScheduleId: params.scheduleId,
    moduleLabel: 'limpieza',
  });

  if (!overlap.ok) {
    throw new Error(overlap.errors.join('\n'));
  }

  return cleaningScheduleRepository.publishSchedule({
    congregationId: params.congregationId,
    scheduleId: params.scheduleId,
    syncMeetings: params.syncMeetings,
  });
};
