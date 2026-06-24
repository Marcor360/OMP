import { getDocFromServer } from 'firebase/firestore';

import {
  congregationDocRef,
  congregationPrivatePlanDocRef,
  systemDocRef,
} from '@/src/lib/firebase/refs';
import { getDocumentCacheFirst } from '@/src/services/repositories/firestore-cache-first';
import type { CongregationRepository } from '@/src/services/repositories/ports/congregation-repository.port';

const CONGREGATION_DOMAIN_CACHE_TTL_MS = 10 * 60 * 1000;
const CONGREGATION_NAME_CACHE_TTL_MS = 5 * 60 * 1000;
const CONGREGATION_PLAN_CACHE_TTL_MS = 60 * 1000;

const mapRecordSnapshot = (snapshot: {
  data: () => Record<string, unknown> | undefined;
}): Record<string, unknown> => snapshot.data() ?? {};

const isIncompleteRecord = (value: Record<string, unknown>): boolean =>
  typeof value !== 'object' || value === null || Array.isArray(value);

export const firestoreCongregationRepository: CongregationRepository = {
  getEmailDomainData: async (
    congregationId: string,
    options?: { forceServer?: boolean }
  ): Promise<Record<string, unknown> | null> =>
    getDocumentCacheFirst<Record<string, unknown>>({
      cacheKey: `congregations/${congregationId}/email-domain`,
      ref: congregationDocRef(congregationId),
      maxAgeMs: CONGREGATION_DOMAIN_CACHE_TTL_MS,
      forceServer: options?.forceServer,
      mapSnapshot: mapRecordSnapshot,
      isIncomplete: isIncompleteRecord,
    }),

  getDisplayNameData: async (
    congregationId: string,
    options?: { forceServer?: boolean }
  ): Promise<Record<string, unknown> | null> =>
    getDocumentCacheFirst<Record<string, unknown>>({
      cacheKey: `congregations/${congregationId}/display-name`,
      ref: congregationDocRef(congregationId),
      maxAgeMs: CONGREGATION_NAME_CACHE_TTL_MS,
      forceServer: options?.forceServer,
      mapSnapshot: mapRecordSnapshot,
      isIncomplete: isIncompleteRecord,
    }),

  getBillingPlanData: async (
    congregationId: string,
    options?: { forceServer?: boolean }
  ): Promise<Record<string, unknown> | null> =>
    getDocumentCacheFirst<Record<string, unknown>>({
      cacheKey: `congregations/${congregationId}/billing-plan`,
      ref: congregationDocRef(congregationId),
      maxAgeMs: CONGREGATION_PLAN_CACHE_TTL_MS,
      forceServer: options?.forceServer,
      persist: false,
      mapSnapshot: mapRecordSnapshot,
    }),

  getPrivatePlanData: async (
    congregationId: string,
    options?: { forceServer?: boolean }
  ): Promise<Record<string, unknown> | null> =>
    getDocumentCacheFirst<Record<string, unknown>>({
      cacheKey: `congregations/${congregationId}/private/plan`,
      ref: congregationPrivatePlanDocRef(congregationId),
      maxAgeMs: CONGREGATION_PLAN_CACHE_TTL_MS,
      forceServer: options?.forceServer,
      persist: false,
      mapSnapshot: mapRecordSnapshot,
    }),

  getAccessData: async (congregationId: string): Promise<Record<string, unknown> | null> => {
    const snap = await getDocFromServer(congregationDocRef(congregationId));
    return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
  },

  getSystemData: async (docId: string): Promise<Record<string, unknown> | null> => {
    const snap = await getDocFromServer(systemDocRef(docId));
    return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
  },
};
