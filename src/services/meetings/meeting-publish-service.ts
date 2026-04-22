import { httpsCallable } from 'firebase/functions';

import { functions } from '@/src/lib/firebase/app';
import { isFirebaseErrorCode } from '@/src/lib/firebase/errors';
import { MeetingPublicationStatus } from '@/src/types/meeting/program';
import { AppError } from '@/src/utils/errors/errors';

export interface SetMeetingPublicationStatusPayload {
  congregationId: string;
  meetingId: string;
  publicationStatus: MeetingPublicationStatus;
}

export interface SetMeetingPublicationStatusResult {
  ok: boolean;
  publicationStatus: MeetingPublicationStatus;
  assignedUserIds: string[];
  errors: string[];
}

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

const isPublicationFunctionUnavailable = (error: unknown): boolean =>
  isFirebaseErrorCode(error, 'unimplemented') ||
  isFirebaseErrorCode(error, 'not-found') ||
  (isFirebaseErrorCode(error, 'internal') && hasNotFoundSignal(error));

export const setMeetingPublicationStatus = async (
  payload: SetMeetingPublicationStatusPayload
): Promise<SetMeetingPublicationStatusResult> => {
  const callable = httpsCallable<
    SetMeetingPublicationStatusPayload,
    SetMeetingPublicationStatusResult
  >(functions, 'setMeetingPublicationStatus');

  try {
    const response = await callable(payload);
    return response.data;
  } catch (error) {
    if (isPublicationFunctionUnavailable(error)) {
      throw new AppError(
        'Publicar reuniones requiere Cloud Functions desplegadas (setMeetingPublicationStatus).'
      );
    }

    throw error;
  }
};
