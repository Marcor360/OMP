import { getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { functions } from '@/src/lib/firebase/app';
import { congregationDocRef } from '@/src/lib/firebase/refs';
import type {
  BillingExemption,
  BillingPlanId,
  CongregationBillingState,
} from '@/src/types/billing';

export type CongregationBillingSummary = {
  congregationId: string;
  billing: CongregationBillingState;
  billingExemption?: BillingExemption;
};

type CheckoutPayload = {
  congregationId: string;
  plan: BillingPlanId;
  successUrl?: string;
  cancelUrl?: string;
};

type PortalPayload = {
  congregationId: string;
  returnUrl?: string;
};

type UrlResult = {
  url?: string;
};

const normalizeBilling = (value: unknown): CongregationBillingState => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {
      enabled: false,
      status: 'disabled',
    };
  }

  const data = value as Record<string, unknown>;
  return {
    enabled: data.enabled === true,
    status: typeof data.status === 'string' ? data.status : 'disabled',
    billingDay: typeof data.billingDay === 'number' ? data.billingDay : undefined,
    billingCycle: typeof data.billingCycle === 'string' ? data.billingCycle : undefined,
    planId:
      data.planId === 'omp_80' || data.planId === 'omp_150' || data.planId === 'omp_250'
        ? data.planId
        : undefined,
    activeUsersLimit: typeof data.activeUsersLimit === 'number' ? data.activeUsersLimit : undefined,
    stripeCustomerId: typeof data.stripeCustomerId === 'string' ? data.stripeCustomerId : undefined,
    stripeSubscriptionId:
      typeof data.stripeSubscriptionId === 'string' ? data.stripeSubscriptionId : undefined,
    currentPeriodStart: data.currentPeriodStart,
    currentPeriodEnd: data.currentPeriodEnd,
    nextPaymentDate: data.nextPaymentDate,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
    updatedAt: data.updatedAt,
  };
};

const normalizeExemption = (value: unknown): BillingExemption | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const data = value as Record<string, unknown>;
  return {
    exempt: data.exempt === true,
    reason: typeof data.reason === 'string' ? data.reason : undefined,
  };
};

export const getCongregationBillingSummary = async (
  congregationId: string
): Promise<CongregationBillingSummary | null> => {
  if (!congregationId.trim()) return null;

  const snap = await getDoc(congregationDocRef(congregationId));
  if (!snap.exists()) return null;
  const data = snap.data() as Record<string, unknown>;

  return {
    congregationId,
    billing: normalizeBilling(data.billing),
    billingExemption: normalizeExemption(data.billingExemption),
  };
};

export const createCheckoutSession = async (payload: CheckoutPayload): Promise<string> => {
  const callable = httpsCallable<CheckoutPayload, UrlResult>(functions, 'createCheckoutSession');
  const result = await callable(payload);
  if (!result.data?.url) throw new Error('Stripe no devolvio URL de pago.');
  return result.data.url;
};

export const createBillingPortalSession = async (payload: PortalPayload): Promise<string> => {
  const callable = httpsCallable<PortalPayload, UrlResult>(functions, 'createBillingPortalSession');
  const result = await callable(payload);
  if (!result.data?.url) throw new Error('Stripe no devolvio URL de portal.');
  return result.data.url;
};
