import { getQueryCacheFirst, invalidateCacheEntry } from '@/src/services/repositories/firestore-cache-first';
import {
  getDoc,
  query,
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

const monthlyKey = (congregationId: string, monthId: string) => `preaching-reports/${congregationId}/${monthId}`;

export const firestorePreachingReportRepository: PreachingReportRepository = {
  getSubmission: async (
    congregationId: string,
    monthId: string,
    userId: string
  ): Promise<PreachingReportSubmissionRecord | null> => {
    const snap = await getDoc(preachingReportSubmissionDocRef(congregationId, monthId, userId));
    return snap.exists() ? { id: snap.id, data: snap.data() as Record<string, unknown> } : null;
  },

  listMonthlySubmissions: (congregationId, monthId, forceServer) => getQueryCacheFirst({
    cacheKey: monthlyKey(congregationId, monthId),
    query: query(preachingReportSubmissionsCollectionRef(congregationId, monthId)),
    maxAgeMs: 60_000,
    persist: false,
    forceServer,
    requireServerOnCacheMiss: true,
    mapSnapshot: (snapshot) => snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() })),
  }),

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
    await invalidateCacheEntry(monthlyKey(congregationId, monthId));
  },
};
