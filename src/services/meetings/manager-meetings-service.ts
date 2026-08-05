import { Timestamp, type Timestamp as TimestampType } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { functions } from '@/src/lib/firebase/app';
import { isFirebaseErrorCode } from '@/src/lib/firebase/errors';
import { AppError } from '@/src/utils/errors/errors';
import {
  getScheduledOutgoingSpeakerIdsForWeek,
  isWeekendMeeting,
} from '@/src/services/meetings/weekend-assignment-conflict-service';
import { validateMeetingBeforeSaveWithPlanning } from '@/src/services/planning/planning-conflict-service';
import { collectAssignedUserIds, type MeetingProgramSection } from '@/src/types/meeting/program';
import { formatDateKey } from '@/src/utils/dates/date-key';

type SerializableTimestamp = {
  seconds: number;
  nanoseconds: number;
};

type CreateMeetingByManagerRequest = {
  congregationId: string;
  meetingData: Record<string, unknown>;
};

type UpdateMeetingByManagerRequest = {
  congregationId: string;
  meetingId: string;
  meetingData: Record<string, unknown>;
  scope?: 'meeting' | 'assignments';
};

type DeleteMeetingByManagerRequest = {
  congregationId: string;
  meetingId: string;
};

type SyncMeetingCleaningAssignmentsRequest = {
  congregationId: string;
  meetingId: string;
  mode: 'none' | 'selected' | 'all';
  groups: { id: string; name: string }[];
  meetingTitle: string;
  meetingDate: TimestampType;
  assignedByName: string;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const toSerializableTimestamp = (value: TimestampType): SerializableTimestamp => ({
  seconds: value.seconds,
  nanoseconds: value.nanoseconds,
});

const toCallableSafe = (value: unknown): unknown => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (value instanceof Timestamp) {
    return toSerializableTimestamp(value);
  }

  if (value instanceof Date) {
    const timestamp = Timestamp.fromDate(value);
    return toSerializableTimestamp(timestamp);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => toCallableSafe(item))
      .filter((item) => item !== undefined);
  }

  if (isPlainObject(value)) {
    const output: Record<string, unknown> = {};

    Object.entries(value).forEach(([key, child]) => {
      const safeChild = toCallableSafe(child);
      if (safeChild !== undefined) {
        output[key] = safeChild;
      }
    });

    return output;
  }

  return value;
};

const hasNotFoundSignal = (error: unknown): boolean => {
  const rawMessage = (error as { message?: unknown })?.message;
  if (typeof rawMessage !== 'string') {
    return false;
  }

  const normalized = rawMessage.toLowerCase();
  return (
    normalized.includes('404') ||
    normalized.includes('not found') ||
    normalized.includes('functions/not-found') ||
    normalized.includes('requested entity was not found')
  );
};

const isFunctionUnavailable = (error: unknown): boolean =>
  isFirebaseErrorCode(error, 'unimplemented') ||
  isFirebaseErrorCode(error, 'not-found') ||
  (isFirebaseErrorCode(error, 'internal') && hasNotFoundSignal(error));

const toMeetingDate = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (value && typeof value === 'object') {
    const raw = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
    if (typeof raw.toDate === 'function') return raw.toDate();
    if (typeof raw.seconds === 'number') {
      return new Timestamp(raw.seconds, raw.nanoseconds ?? 0).toDate();
    }
  }
  return null;
};

const getUserNamesById = (sections: MeetingProgramSection[]): Map<string, string> => {
  const names = new Map<string, string>();
  sections.forEach((section) => {
    section.assignments.forEach((assignment) => {
      assignment.assignees.forEach((assignee) => {
        if (assignee.assigneeUserId && assignee.assigneeNameSnapshot) {
          names.set(assignee.assigneeUserId, assignee.assigneeNameSnapshot);
        }
      });
    });
  });
  return names;
};

const assertNoWeekendOutgoingTalkConflict = async (params: {
  congregationId: string;
  meetingData: Record<string, unknown>;
}): Promise<void> => {
  if (!isWeekendMeeting(params.meetingData)) return;

  const sections = Array.isArray(params.meetingData.sections)
    ? params.meetingData.sections as MeetingProgramSection[]
    : [];
  const assignedUserIds = collectAssignedUserIds(sections);
  if (assignedUserIds.length === 0) return;

  const meetingDate = toMeetingDate(params.meetingData.meetingDate) ??
    toMeetingDate(params.meetingData.startDate);
  if (!meetingDate) throw new AppError('La reunion debe tener una fecha valida.');

  const weekDate = formatDateKey(meetingDate);
  const outgoingIds = await getScheduledOutgoingSpeakerIdsForWeek({
    congregationId: params.congregationId,
    weekDate,
  });
  const validation = validateMeetingBeforeSaveWithPlanning({
    assignedUserIds,
    scheduledOutgoingTalkSpeakerIds: [...outgoingIds],
    userNamesById: getUserNamesById(sections),
    weekDate,
  });
  if (!validation.ok) throw new AppError(validation.errors.join('\n'));
};

export const createMeetingByManager = async (
  params: CreateMeetingByManagerRequest
): Promise<string> => {
  await assertNoWeekendOutgoingTalkConflict(params);
  const callable = httpsCallable<
    CreateMeetingByManagerRequest,
    { meetingId: string }
  >(functions, 'createMeetingByManager');

  try {
    const response = await callable({
      congregationId: params.congregationId,
      meetingData: toCallableSafe(params.meetingData) as Record<string, unknown>,
    });

    const meetingId = response.data?.meetingId;
    if (!meetingId || typeof meetingId !== 'string') {
      throw new AppError('No se pudo confirmar la creacion de la reunion.');
    }

    return meetingId;
  } catch (error) {
    if (isFunctionUnavailable(error)) {
      throw new AppError(
        'La creacion de reuniones requiere Cloud Functions (createMeetingByManager).'
      );
    }

    throw error;
  }
};

export const updateMeetingByManager = async (
  params: UpdateMeetingByManagerRequest
): Promise<void> => {
  if (params.scope !== 'assignments') {
    await assertNoWeekendOutgoingTalkConflict(params);
  }
  const callable = httpsCallable<
    UpdateMeetingByManagerRequest,
    { ok: true }
  >(functions, 'updateMeetingByManager');

  try {
    await callable({
      congregationId: params.congregationId,
      meetingId: params.meetingId,
      meetingData: toCallableSafe(params.meetingData) as Record<string, unknown>,
      scope: params.scope,
    });
  } catch (error) {
    if (isFunctionUnavailable(error)) {
      throw new AppError(
        'La edicion de reuniones requiere Cloud Functions (updateMeetingByManager).'
      );
    }

    throw error;
  }
};

export const updateMeetingAssignmentsByManager = async (params: {
  congregationId: string;
  meetingId: string;
  sections: MeetingProgramSection[];
}): Promise<void> =>
  updateMeetingByManager({
    congregationId: params.congregationId,
    meetingId: params.meetingId,
    meetingData: { sections: params.sections },
    scope: 'assignments',
  });

export const deleteMeetingByManager = async (
  params: DeleteMeetingByManagerRequest
): Promise<void> => {
  const callable = httpsCallable<
    DeleteMeetingByManagerRequest,
    { ok: true }
  >(functions, 'deleteMeetingByManager');

  try {
    await callable({
      congregationId: params.congregationId,
      meetingId: params.meetingId,
    });
  } catch (error) {
    if (isFunctionUnavailable(error)) {
      throw new AppError(
        'La eliminacion de reuniones requiere Cloud Functions (deleteMeetingByManager).'
      );
    }

    throw error;
  }
};

export const syncMeetingCleaningAssignmentsByManager = async (
  params: SyncMeetingCleaningAssignmentsRequest
): Promise<void> => {
  const callable = httpsCallable<
    Omit<SyncMeetingCleaningAssignmentsRequest, 'meetingDate'> & { meetingDate: SerializableTimestamp },
    { ok: true }
  >(functions, 'syncMeetingCleaningAssignmentsByManager');

  try {
    await callable({
      congregationId: params.congregationId,
      meetingId: params.meetingId,
      mode: params.mode,
      groups: params.groups,
      meetingTitle: params.meetingTitle,
      meetingDate: toSerializableTimestamp(params.meetingDate),
      assignedByName: params.assignedByName,
    });
  } catch (error) {
    if (isFunctionUnavailable(error)) {
      throw new AppError(
        'La asignacion de limpieza por reunion requiere Cloud Functions (syncMeetingCleaningAssignmentsByManager).'
      );
    }

    throw error;
  }
};
