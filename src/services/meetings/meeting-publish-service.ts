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
    if (
      isFirebaseErrorCode(error, 'unimplemented') ||
      isFirebaseErrorCode(error, 'not-found')
    ) {
      throw new AppError(
        'Publicar reuniones requiere Cloud Functions desplegadas (setMeetingPublicationStatus).'
      );
    }

    throw error;
  }
};