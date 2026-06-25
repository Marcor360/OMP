import { firestoreHospitalityScheduleRepository } from '@/src/services/repositories/firestore/firestore-hospitality-schedule-repository';
import type { HospitalityScheduleRepository } from '@/src/services/repositories/ports/hospitality-schedule-repository.port';
import {
  buildPlanningWindow,
  validatePlanningWindow,
} from '@/src/services/planning/operational-planning-service';
import { validateNoPublishedScheduleOverlap } from '@/src/services/planning/planning-conflict-service';
import type {
  HospitalitySchedule,
  HospitalityScheduleItem,
} from '@/src/types/hospitality-microphones';

let hospitalityScheduleRepository: HospitalityScheduleRepository =
  firestoreHospitalityScheduleRepository;

export const __setHospitalityScheduleRepositoryForTests = (
  repo: HospitalityScheduleRepository
): void => {
  hospitalityScheduleRepository = repo;
};

export const __resetHospitalityScheduleRepositoryForTests = (): void => {
  hospitalityScheduleRepository = firestoreHospitalityScheduleRepository;
};

export const getHospitalitySchedules = async (
  congregationId: string
): Promise<HospitalitySchedule[]> => {
  if (!congregationId) return [];
  return hospitalityScheduleRepository.listSchedules(congregationId);
};

export const getHospitalityScheduleItems = async (params: {
  congregationId: string;
  scheduleId: string;
}): Promise<HospitalityScheduleItem[]> => {
  if (!params.congregationId || !params.scheduleId) return [];
  return hospitalityScheduleRepository.listScheduleItems(
    params.congregationId,
    params.scheduleId
  );
};

export const getHospitalityAssignmentsForMeetingDate = async (params: {
  congregationId: string;
  meetingDate: string;
  meetingType: 'midweek' | 'weekend';
}): Promise<HospitalityScheduleItem[]> => {
  if (!params.congregationId || !params.meetingDate) return [];

  const schedules = await hospitalityScheduleRepository.listPublishedSchedules(
    params.congregationId
  );
  const matchingSchedules = schedules.filter(
    (schedule) => schedule.startDate <= params.meetingDate && schedule.endDate >= params.meetingDate
  );
  const results = await Promise.all(
    matchingSchedules.map((schedule) =>
      hospitalityScheduleRepository.listScheduledItemsForDateAndType({
        congregationId: params.congregationId,
        scheduleId: schedule.id,
        meetingDate: params.meetingDate,
        meetingType: params.meetingType,
      })
    )
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
  return hospitalityScheduleRepository.addSchedule({
    congregationId: params.congregationId,
    title: params.title.trim(),
    startDate: window.startDate,
    endDate: window.endDate,
    monthIds: window.monthIds,
    totalMeetings: params.totalMeetings,
    actorUid: params.actorUid,
  });
};

export const saveHospitalityScheduleItems = async (params: {
  congregationId: string;
  scheduleId: string;
  items: Omit<HospitalityScheduleItem, 'id' | 'createdAt' | 'updatedAt'>[];
  actorUid: string;
}): Promise<void> => {
  return hospitalityScheduleRepository.upsertScheduleItems(params);
};

export const publishHospitalitySchedule = async (params: {
  congregationId: string;
  scheduleId: string;
  actorUid: string;
  startDate: string;
  endDate: string;
  syncMeetings?: boolean;
}): Promise<{ syncedMeetings: number; missingMeetings: number }> => {
  const existingSchedules = await hospitalityScheduleRepository.listPublishedSchedules(
    params.congregationId
  );
  const overlap = validateNoPublishedScheduleOverlap({
    window: { startDate: params.startDate, endDate: params.endDate },
    schedules: existingSchedules,
    excludeScheduleId: params.scheduleId,
    moduleLabel: 'acomodadores y microfonos',
  });

  if (!overlap.ok) {
    throw new Error(overlap.errors.join('\n'));
  }

  return hospitalityScheduleRepository.publishSchedule({
    congregationId: params.congregationId,
    scheduleId: params.scheduleId,
    syncMeetings: params.syncMeetings,
  });
};
