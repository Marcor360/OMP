import {
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import {
  preachingReportSubmissionDocRef,
  preachingReportSubmissionsCollectionRef,
} from '@/src/lib/firebase/refs';
import type {
  PreachingReportRepository,
  PreachingReportSubmissionRecord,
} from '@/src/services/repositories/ports/preaching-report-repository.port';

export const firestorePreachingReportRepository: PreachingReportRepository = {
  getSubmission: async (
    congregationId: string,
    monthId: string,
    userId: string
  ): Promise<PreachingReportSubmissionRecord | null> => {
    const snap = await getDoc(preachingReportSubmissionDocRef(congregationId, monthId, userId));
    return snap.exists() ? { id: snap.id, data: snap.data() as Record<string, unknown> } : null;
  },

  listMonthlySubmissions: async (
    congregationId: string,
    monthId: string
  ): Promise<PreachingReportSubmissionRecord[]> => {
    const snap = await getDocs(preachingReportSubmissionsCollectionRef(congregationId, monthId));
    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      data: docSnap.data() as Record<string, unknown>,
    }));
  },

  upsertSubmission: async (
    congregationId: string,
    monthId: string,
    userId: string,
    payload: Record<string, unknown>,
    options?: { includeSubmittedAt?: boolean }
  ): Promise<void> => {
    await setDoc(
      preachingReportSubmissionDocRef(congregationId, monthId, userId),
      {
        ...payload,
        ...(options?.includeSubmittedAt ? { submittedAt: serverTimestamp() } : {}),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  },
};
