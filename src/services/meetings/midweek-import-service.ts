import { httpsCallable } from 'firebase/functions';

import { functions } from '@/src/lib/firebase/app';
import { isFirebaseErrorCode } from '@/src/lib/firebase/errors';
import { AppError } from '@/src/utils/errors/errors';

interface ImportMidweekMeetingsFromPdfPayload {
  congregationId: string;
  pdfBase64: string;
  fileName?: string;
}

export interface ImportMidweekMeetingsFromPdfResult {
  ok: boolean;
  createdCount: number;
  updatedCount: number;
  totalWeeks: number;
  importedWeekLabels: string[];
}

export const importMidweekMeetingsFromPdf = async (
  payload: ImportMidweekMeetingsFromPdfPayload
): Promise<ImportMidweekMeetingsFromPdfResult> => {
  const callable = httpsCallable<
    ImportMidweekMeetingsFromPdfPayload,
    ImportMidweekMeetingsFromPdfResult
  >(functions, "importMidweekMeetingsFromPdf");

  try {
    const response = await callable(payload);
    return response.data;
  } catch (error) {
    if (
      isFirebaseErrorCode(error, "unimplemented") ||
      isFirebaseErrorCode(error, "not-found")
    ) {
      throw new AppError(
        'La importacion de PDF requiere la Cloud Function ' +
          'importMidweekMeetingsFromPdf desplegada.'
      );
    }

    throw error;
  }
};
