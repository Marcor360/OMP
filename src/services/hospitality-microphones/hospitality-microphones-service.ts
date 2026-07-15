import { firestoreHospitalityScheduleRepository } from '@/src/services/repositories/firestore/firestore-hospitality-schedule-repository';
import type {
  EnsurePlanningMeetingsParams,
  EnsurePlanningMeetingsResult,
  HospitalityScheduleRepository,
} from '@/src/services/repositories/ports/hospitality-schedule-repository.port';
import {
  buildPlanningWindow,
  validatePlanningWindow,
} from '@/src/services/planning/operational-planning-service';
import { validateHospitalityScheduleBeforePublish } from '@/src/services/planning/planning-conflict-service';
import { getScheduledOutgoingTalksInRange } from '@/src/modules/assignments/services/outgoing-talks.service';
import { getActiveCongregationUsers } from '@/src/services/users/active-users-service';
import type {
  HospitalityOptionalRoles,
  HospitalitySchedule,
  HospitalityScheduleItem,
} from '@/src/types/hospitality-microphones';
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
  options?: { canManage?: boolean; actorUid?: string; today?: string }
): Promise<HospitalitySchedule[]> => {
  if (!congregationId) return [];
  const schedules = await hospitalityScheduleRepository.listSchedules(congregationId);
  const today = options?.today ?? formatDateKey(new Date());
  const expiredPublished = schedules.filter(
    (schedule) => schedule.status === 'published' && schedule.endDate < today
  );
  const actorUid = options?.actorUid;

  if (options?.canManage && actorUid && expiredPublished.length > 0) {
    await Promise.all(
      expiredPublished.map((schedule) =>
        hospitalityScheduleRepository.archiveSchedule({
          congregationId,
          scheduleId: schedule.id,
          actorUid,
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

export const createHospitalitySchedule = async (params: {
  congregationId: string;
  title: string;
  startDate: Date;
  endDate: Date;
  totalMeetings: number;
  actorUid: string;
  optionalRoles?: HospitalityOptionalRoles;
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
    optionalRoles: params.optionalRoles,
  });
};

export const updateHospitalityScheduleOptionalRoles = async (params: {
  congregationId: string;
  scheduleId: string;
  optionalRoles: HospitalityOptionalRoles;
  actorUid: string;
}): Promise<void> => {
  return hospitalityScheduleRepository.updateScheduleOptionalRoles(params);
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
