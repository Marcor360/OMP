import { Timestamp, type Timestamp as TimestampType } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { functions } from '@/src/lib/firebase/app';
import { isFirebaseErrorCode } from '@/src/lib/firebase/errors';
import { AppError } from '@/src/utils/errors/errors';

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

export const createMeetingByManager = async (
  params: CreateMeetingByManagerRequest
): Promise<string> => {
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
  const callable = httpsCallable<
    UpdateMeetingByManagerRequest,
    { ok: true }
  >(functions, 'updateMeetingByManager');

  try {
    await callable({
      congregationId: params.congregationId,
      meetingId: params.meetingId,
      meetingData: toCallableSafe(params.meetingData) as Record<string, unknown>,
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
