import {
  PlanningValidationResult,
  PlanningWindow,
} from '@/src/services/planning/operational-planning-service';
import { resolveOutgoingTalkWeekRange } from '@/src/modules/assignments/utils/outgoing-talks';
import { isEligibleForHospitalityRole } from '@/src/modules/assignments/utils/hospitality-eligibility';
import type { HospitalityRoleKey } from '@/src/types/hospitality-microphones';

type MeetingType = 'midweek' | 'weekend';

export type PublishedScheduleWindow = {
  id: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'published' | 'archived' | string;
};

export type PlanningUserCandidate = {
  uid: string;
  displayName?: string;
  congregationId: string;
  isActive: boolean;
  isElder?: boolean;
  isMinisterialServant?: boolean;
};

export type HospitalityPlanningItem = {
  meetingDate: string;
  meetingType: MeetingType;
  roleKey: string;
  roleLabel?: string;
  userId?: string;
};

export type CleaningPlanningItem = {
  meetingDate: string;
  meetingType: MeetingType;
  cleaningGroupId?: string;
  cleaningGroupName?: string;
};

export type CleaningGroupCandidate = {
  id: string;
  name: string;
  congregationId: string;
  isActive: boolean;
  memberIds?: string[];
  memberCount?: number;
};

export type OutgoingTalkConflictCandidate = {
  id?: string;
  speakerUserId: string;
  weekStartDate: string;
  talkDate?: string;
  speakerName?: string;
  status: 'scheduled' | 'cancelled' | 'completed' | string;
};

const validateHospitalityOutgoingTalkConflicts = (params: {
  items: HospitalityPlanningItem[];
  outgoingTalks: OutgoingTalkConflictCandidate[];
  users: PlanningUserCandidate[];
}): PlanningValidationResult => {
  const usersById = new Map(params.users.map((user) => [user.uid, user.displayName]));
  const errors: string[] = [];

  params.items.forEach((item) => {
    if (item.meetingType !== 'weekend' || !item.userId) return;

    const conflict = params.outgoingTalks.find((talk) => {
      if (talk.status !== 'scheduled' || talk.speakerUserId !== item.userId) return false;
      const range = resolveOutgoingTalkWeekRange(talk.weekStartDate);
      return item.meetingDate >= range.weekStartDate && item.meetingDate <= range.weekEndDate;
    });
    if (!conflict) return;

    const name = conflict.speakerName ?? usersById.get(item.userId) ?? item.userId;
    const date = conflict.talkDate ?? item.meetingDate;
    errors.push(
      `${name} no puede tener asignaciones el fin de semana: sale a discursar esa semana (${date}).`
    );
  });

  return errorResult(errors);
};

export const validateHospitalityRoleEligibility = (params: {
  items: HospitalityPlanningItem[];
  users: PlanningUserCandidate[];
}): PlanningValidationResult => {
  const usersById = new Map(params.users.map((user) => [user.uid, user]));
  const errors: string[] = [];

  params.items.forEach((item) => {
    if (!item.userId) return;
    const user = usersById.get(item.userId);
    if (!user) return;

    const eligible = isEligibleForHospitalityRole(
      { isElder: user.isElder ?? false, isMinisterialServant: user.isMinisterialServant ?? false },
      item.roleKey as HospitalityRoleKey
    );
    if (!eligible) {
      errors.push(
        `${user.displayName ?? item.userId} no es anciano ni siervo ministerial: no puede cumplir ${item.roleLabel ?? item.roleKey} (${item.meetingDate}).`
      );
    }
  });

  return errorResult(errors);
};

const okResult = (warnings: string[] = []): PlanningValidationResult => ({
  ok: true,
  errors: [],
  warnings,
});

const errorResult = (errors: string[], warnings: string[] = []): PlanningValidationResult => ({
  ok: errors.length === 0,
  errors: Array.from(new Set(errors)),
  warnings: Array.from(new Set(warnings)),
});

const mergeResults = (...results: PlanningValidationResult[]): PlanningValidationResult => {
  const errors = results.flatMap((result) => result.errors);
  const warnings = results.flatMap((result) => result.warnings);
  return errorResult(errors, warnings);
};

export const planningDateRangesOverlap = (
  leftStartDate: string,
  leftEndDate: string,
  rightStartDate: string,
  rightEndDate: string
): boolean => leftStartDate <= rightEndDate && rightStartDate <= leftEndDate;

export const validateNoPublishedScheduleOverlap = (params: {
  window: Pick<PlanningWindow, 'startDate' | 'endDate'>;
  schedules: PublishedScheduleWindow[];
  excludeScheduleId?: string;
  moduleLabel: string;
}): PlanningValidationResult => {
  const conflict = params.schedules.find((schedule) => (
    schedule.status === 'published' &&
    schedule.id !== params.excludeScheduleId &&
    planningDateRangesOverlap(
      params.window.startDate,
      params.window.endDate,
      schedule.startDate,
      schedule.endDate
    )
  ));

  if (!conflict) return okResult();

  return errorResult([
    `Ya existe una lista publicada de ${params.moduleLabel} que se traslapa con ese rango.`,
  ]);
};

export const validateUsersActiveInCongregation = (params: {
  congregationId: string;
  userIds: string[];
  users: PlanningUserCandidate[];
}): PlanningValidationResult => {
  const usersById = new Map(params.users.map((user) => [user.uid, user]));
  const errors: string[] = [];

  Array.from(new Set(params.userIds.filter(Boolean))).forEach((userId) => {
    const user = usersById.get(userId);
    const label = user?.displayName ?? userId;

    if (!user) {
      errors.push(`El usuario ${label} no existe.`);
      return;
    }

    if (user.congregationId !== params.congregationId) {
      errors.push(`El usuario ${label} no pertenece a esta congregacion.`);
    }

    if (!user.isActive) {
      errors.push(`El usuario ${label} esta inactivo.`);
    }
  });

  return errorResult(errors);
};

export const validateNoDuplicateUsersPerMeeting = (
  items: HospitalityPlanningItem[]
): PlanningValidationResult => {
  const errors: string[] = [];
  const byMeeting = new Map<string, Map<string, string[]>>();

  items.forEach((item) => {
    if (!item.userId) return;

    const meetingKey = `${item.meetingDate}:${item.meetingType}`;
    const users = byMeeting.get(meetingKey) ?? new Map<string, string[]>();
    const roles = users.get(item.userId) ?? [];
    roles.push(item.roleLabel ?? item.roleKey);
    users.set(item.userId, roles);
    byMeeting.set(meetingKey, users);
  });

  byMeeting.forEach((users, meetingKey) => {
    users.forEach((roles, userId) => {
      if (roles.length > 1) {
        errors.push(
          `El usuario ${userId} esta duplicado en la reunion ${meetingKey}: ${roles.join(', ')}.`
        );
      }
    });
  });

  return errorResult(errors);
};

export const validateHospitalityScheduleBeforePublish = (params: {
  congregationId: string;
  window: PlanningWindow;
  existingSchedules: PublishedScheduleWindow[];
  scheduleId?: string;
  items: HospitalityPlanningItem[];
  users: PlanningUserCandidate[];
  outgoingTalks: OutgoingTalkConflictCandidate[];
  requiredMeetingKeys?: string[];
}): PlanningValidationResult => {
  const requiredMeetingKeys = params.requiredMeetingKeys ?? [];
  const assignedUserIds = params.items
    .map((item) => item.userId)
    .filter((userId): userId is string => Boolean(userId));
  const missingAssignments = params.items
    .filter((item) => !item.userId)
    .map((item) => `${item.meetingDate} ${item.roleLabel ?? item.roleKey}`);
  const presentMeetingKeys = new Set(
    params.items.map((item) => `${item.meetingDate}:${item.meetingType}`)
  );
  const missingMeetings = requiredMeetingKeys.filter((key) => !presentMeetingKeys.has(key));

  return mergeResults(
    validateNoPublishedScheduleOverlap({
      window: params.window,
      schedules: params.existingSchedules,
      excludeScheduleId: params.scheduleId,
      moduleLabel: 'acomodadores y microfonos',
    }),
    validateUsersActiveInCongregation({
      congregationId: params.congregationId,
      userIds: assignedUserIds,
      users: params.users,
    }),
    validateNoDuplicateUsersPerMeeting(params.items),
    validateHospitalityOutgoingTalkConflicts({
      items: params.items,
      outgoingTalks: params.outgoingTalks,
      users: params.users,
    }),
    validateHospitalityRoleEligibility({
      items: params.items,
      users: params.users,
    }),
    errorResult([
      ...missingAssignments.map((item) => `Falta asignar ${item}.`),
      ...missingMeetings.map((item) => `Falta programar la reunion ${item}.`),
    ])
  );
};

export const validateCleaningScheduleBeforePublish = (params: {
  congregationId: string;
  window: PlanningWindow;
  existingSchedules: PublishedScheduleWindow[];
  scheduleId?: string;
  items: CleaningPlanningItem[];
  groups: CleaningGroupCandidate[];
  requiredMeetingKeys?: string[];
}): PlanningValidationResult => {
  const groupsById = new Map(params.groups.map((group) => [group.id, group]));
  const requiredMeetingKeys = params.requiredMeetingKeys ?? [];
  const presentMeetingKeys = new Set(
    params.items.map((item) => `${item.meetingDate}:${item.meetingType}`)
  );
  const errors: string[] = [];

  params.items.forEach((item) => {
    if (!item.cleaningGroupId) {
      errors.push(`Falta grupo de limpieza para ${item.meetingDate}.`);
      return;
    }

    const group = groupsById.get(item.cleaningGroupId);
    const label = group?.name ?? item.cleaningGroupName ?? item.cleaningGroupId;

    if (!group) {
      errors.push(`El grupo ${label} no existe.`);
      return;
    }

    if (group.congregationId !== params.congregationId) {
      errors.push(`El grupo ${label} no pertenece a esta congregacion.`);
    }

    if (!group.isActive) {
      errors.push(`El grupo ${label} esta inactivo.`);
    }

    if ((group.memberCount ?? group.memberIds?.length ?? 0) <= 0) {
      errors.push(`El grupo ${label} no tiene integrantes.`);
    }
  });

  requiredMeetingKeys
    .filter((key) => !presentMeetingKeys.has(key))
    .forEach((key) => errors.push(`Falta programar limpieza para la reunion ${key}.`));

  return mergeResults(
    validateNoPublishedScheduleOverlap({
      window: params.window,
      schedules: params.existingSchedules,
      excludeScheduleId: params.scheduleId,
      moduleLabel: 'limpieza',
    }),
    errorResult(errors)
  );
};

export const validateOutgoingTalkBeforeSave = (params: {
  speakerUserId: string;
  weekStartDate: string;
  existingOutgoingTalks: OutgoingTalkConflictCandidate[];
  weekendAssignedUserIds: string[];
  excludeOutgoingTalkId?: string;
}): PlanningValidationResult => {
  const duplicate = params.existingOutgoingTalks.some((talk) => (
    talk.id !== params.excludeOutgoingTalkId &&
    talk.status === 'scheduled' &&
    talk.speakerUserId === params.speakerUserId &&
    talk.weekStartDate === params.weekStartDate
  ));
  const hasWeekendAssignment = params.weekendAssignedUserIds.includes(params.speakerUserId);
  const errors: string[] = [];

  if (duplicate) {
    errors.push('Este hermano ya tiene una salida activa en esa misma semana.');
  }

  if (hasWeekendAssignment) {
    errors.push(
      'No se puede asignar. Este hermano ya tiene una asignacion en la reunion de fin de semana de esa semana.'
    );
  }

  return errorResult(errors);
};

export const validateMeetingBeforeSaveWithPlanning = (params: {
  assignedUserIds: string[];
  scheduledOutgoingTalkSpeakerIds: string[];
  userNamesById?: Map<string, string>;
  weekDate?: string;
}): PlanningValidationResult => {
  const blocked = params.assignedUserIds.filter((userId) =>
    params.scheduledOutgoingTalkSpeakerIds.includes(userId)
  );

  if (blocked.length === 0) return okResult();

  return errorResult(
    blocked.map((userId) =>
      `${params.userNamesById?.get(userId) ?? userId} no esta disponible${
        params.weekDate ? ` el fin de semana de ${params.weekDate}` : ''
      }: salida a discursar esta semana.`
    )
  );
};
