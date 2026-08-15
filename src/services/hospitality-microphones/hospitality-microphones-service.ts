import { firestoreHospitalityScheduleRepository } from '@/src/services/repositories/firestore/firestore-hospitality-schedule-repository';
import type {
  ArchiveHospitalityScheduleResult,
  EnsurePlanningMeetingsParams,
  EnsurePlanningMeetingsResult,
  HospitalityScheduleRepository,
  SaveHospitalityScheduleDraftParams,
  SaveHospitalityScheduleDraftResult,
} from '@/src/services/repositories/ports/hospitality-schedule-repository.port';
import {
  buildPlanningWindow,
  validatePlanningWindow,
} from '@/src/services/planning/operational-planning-service';
import { validateHospitalityScheduleBeforePublish } from '@/src/services/planning/planning-conflict-service';
import { getScheduledOutgoingTalksInRange } from '@/src/modules/assignments/services/outgoing-talks.service';
import { getActiveCongregationUsers } from '@/src/services/users/active-users-service';
import type { HospitalitySchedule, HospitalityScheduleItem } from '@/src/types/hospitality-microphones';
import { formatDateKey, parseDateKey } from '@/src/utils/dates/date-key';

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

export const ensurePlanningMeetings = async (
  params: EnsurePlanningMeetingsParams
): Promise<EnsurePlanningMeetingsResult> =>
  hospitalityScheduleRepository.ensurePlanningMeetings(params);

export const getHospitalitySchedules = async (
  congregationId: string,
  options?: { canManage?: boolean; today?: string }
): Promise<HospitalitySchedule[]> => {
  if (!congregationId) return [];
  const schedules = await hospitalityScheduleRepository.listSchedules(congregationId);
  const today = options?.today ?? formatDateKey(new Date());
  const expiredPublished = schedules.filter(
    (schedule) => schedule.status === 'published' && schedule.endDate < today
  );
  if (options?.canManage && expiredPublished.length > 0) {
    await Promise.all(
      expiredPublished.map((schedule) =>
        hospitalityScheduleRepository.archiveSchedule({
          congregationId,
          scheduleId: schedule.id,
        })
      )
    );
  }

  return schedules.filter(
    (schedule) => !(schedule.status === 'published' && schedule.endDate < today)
  );
};

export const getCurrentPublishedHospitalitySchedule = async (
  congregationId: string,
  today = formatDateKey(new Date())
): Promise<HospitalitySchedule | null> => {
  if (!congregationId) return null;
  const schedules = await hospitalityScheduleRepository.listPublishedSchedules(congregationId);
  return schedules
    .filter((schedule) => schedule.startDate <= today && schedule.endDate >= today)
    .sort((left, right) => right.startDate.localeCompare(left.startDate))[0] ?? null;
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

export const saveHospitalityScheduleDraft = async (
  params: SaveHospitalityScheduleDraftParams
): Promise<SaveHospitalityScheduleDraftResult> => {
  const parsedStart = parseDateKey(params.startDate);
  const parsedEnd = parseDateKey(params.endDate);
  if (!parsedStart || !parsedEnd) {
    throw new Error('El rango de la lista no es valido.');
  }

  const validation = validatePlanningWindow({
    startDate: parsedStart,
    endDate: parsedEnd,
    module: 'hospitalityMicrophones',
  });
  if (!validation.ok) {
    throw new Error(validation.errors.join('\n'));
  }

  return hospitalityScheduleRepository.saveDraft({
    ...params,
    title: params.title.trim(),
  });
};

export const archiveHospitalitySchedule = async (params: {
  congregationId: string;
  scheduleId: string;
}): Promise<ArchiveHospitalityScheduleResult> => {
  if (!params.congregationId || !params.scheduleId) {
    throw new Error('Faltan datos para archivar la lista.');
  }
  return hospitalityScheduleRepository.archiveSchedule(params);
};

export const publishHospitalitySchedule = async (params: {
  congregationId: string;
  scheduleId: string;
  actorUid: string;
  startDate: string;
  endDate: string;
  syncMeetings?: boolean;
}): Promise<{ syncedMeetings: number; missingMeetings: number }> => {
  const parsedStart = parseDateKey(params.startDate);
  const parsedEnd = parseDateKey(params.endDate);
  if (!parsedStart || !parsedEnd) {
    throw new Error('El rango de la lista no es valido.');
  }

  const [existingSchedules, items, users, outgoingTalks] = await Promise.all([
    hospitalityScheduleRepository.listPublishedSchedules(params.congregationId),
    hospitalityScheduleRepository.listScheduleItems(params.congregationId, params.scheduleId),
    getActiveCongregationUsers(params.congregationId),
    getScheduledOutgoingTalksInRange(
      params.congregationId,
      params.startDate,
      params.endDate
    ),
  ]);
  const validation = validateHospitalityScheduleBeforePublish({
    congregationId: params.congregationId,
    window: buildPlanningWindow(parsedStart, parsedEnd),
    existingSchedules,
    scheduleId: params.scheduleId,
    items,
    users,
    outgoingTalks,
  });

  if (!validation.ok) {
    throw new Error(validation.errors.join('\n'));
  }

  return hospitalityScheduleRepository.publishSchedule({
    congregationId: params.congregationId,
    scheduleId: params.scheduleId,
    syncMeetings: params.syncMeetings,
  });
};

export const substituteHospitalityAssignment = async (params: {
  congregationId: string;
  scheduleId: string;
  itemId: string;
  newUserId: string;
}): Promise<{ meetingSynced: boolean }> => {
  if (!params.congregationId || !params.scheduleId || !params.itemId || !params.newUserId) {
    throw new Error('Faltan datos para sustituir la asignacion.');
  }

  return hospitalityScheduleRepository.substituteAssignment(params);
};
