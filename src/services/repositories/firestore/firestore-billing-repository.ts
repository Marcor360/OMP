import { getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { functions } from '@/src/lib/firebase/app';
import { congregationDocRef } from '@/src/lib/firebase/refs';
import type { BillingRepository } from '@/src/services/repositories/ports/billing-repository.port';
import type { BillingPlanKey } from '@/src/types/billing';

type UrlResult = {
  url?: string;
};

type BillingUsageResult = {
  activeUsersCount?: number;
};

export const firestoreBillingRepository: BillingRepository = {
  getCongregationDoc: async (
    congregationId: string
  ): Promise<Record<string, unknown> | null> => {
    const snap = await getDoc(congregationDocRef(congregationId));
    if (!snap.exists()) return null;
    return snap.data() as Record<string, unknown>;
  },

  createCheckoutSession: async (payload: {
    congregationId: string;
    planKey: BillingPlanKey;
  }): Promise<string> => {
    const callable = httpsCallable<typeof payload, UrlResult>(
      functions,
      'createStripeCheckoutSession'
    );
    const result = await callable(payload);
    if (!result.data?.url) throw new Error('Stripe no devolvio URL de pago.');
    return result.data.url;
  },

  createPortalSession: async (payload: {
    congregationId: string;
  }): Promise<string> => {
    const callable = httpsCallable<typeof payload, UrlResult>(
      functions,
      'createStripePortalSession'
    );
    const result = await callable(payload);
    if (!result.data?.url) throw new Error('Stripe no devolvio URL de portal.');
    return result.data.url;
  },

  getBillingUsage: async (payload: {
    congregationId: string;
  }): Promise<number | null> => {
    const callable = httpsCallable<typeof payload, BillingUsageResult>(
      functions,
      'getStripeBillingUsage'
    );
    const result = await callable(payload);
    return typeof result.data?.activeUsersCount === 'number'
      ? result.data.activeUsersCount
      : null;
  },
};
