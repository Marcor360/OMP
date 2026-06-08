import { getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { functions } from '@/src/lib/firebase/app';
import { congregationDocRef } from '@/src/lib/firebase/refs';
import type {
  BillingExemption,
  BillingPlanKey,
  CongregationBillingState,
} from '@/src/types/billing';

export type CongregationBillingSummary = {
  congregationId: string;
  billing: CongregationBillingState;
  billingExemption?: BillingExemption;
};

type CheckoutPayload = {
  congregationId: string;
  planKey: BillingPlanKey;
};

type PortalPayload = {
  congregationId: string;
};

type UrlResult = {
  url?: string;
};

type BillingUsageResult = {
  activeUsersCount?: number;
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
    provider: typeof data.provider === 'string' ? data.provider : undefined,
    status: typeof data.status === 'string' ? data.status : 'disabled',
    billingDay: typeof data.billingDay === 'number' ? data.billingDay : undefined,
    billingCycle: typeof data.billingCycle === 'string' ? data.billingCycle : undefined,
    planKey:
      data.planKey === 'omp_80' || data.planKey === 'omp_150' || data.planKey === 'omp_250'
        ? data.planKey
        : undefined,
    activeUsersLimit: typeof data.activeUsersLimit === 'number' ? data.activeUsersLimit : undefined,
    stripePriceId: typeof data.stripePriceId === 'string' ? data.stripePriceId : undefined,
    stripeCustomerId: typeof data.stripeCustomerId === 'string' ? data.stripeCustomerId : undefined,
    stripeSubscriptionId:
      typeof data.stripeSubscriptionId === 'string' ? data.stripeSubscriptionId : undefined,
    currentPeriodStart: data.currentPeriodStart,
    currentPeriodEnd: data.currentPeriodEnd,
    nextPaymentDate: data.nextPaymentDate,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd === true,
    lastPaymentStatus:
      typeof data.lastPaymentStatus === 'string' ? data.lastPaymentStatus : undefined,
    lastInvoiceUrl: typeof data.lastInvoiceUrl === 'string' ? data.lastInvoiceUrl : undefined,
    updatedAt: data.updatedAt,
  };
};

const normalizeExemption = (value: unknown): BillingExemption | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const data = value as Record<string, unknown>;
  return {
    exempt: data.exempt === true,
    reason: typeof data.reason === 'string' ? data.reason : undefined,
    grantedBy: typeof data.grantedBy === 'string' ? data.grantedBy : undefined,
    grantedAt: data.grantedAt,
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

export const createStripeCheckoutSession = async (payload: CheckoutPayload): Promise<string> => {
  const callable = httpsCallable<CheckoutPayload, UrlResult>(
    functions,
    'createStripeCheckoutSession'
  );
  const result = await callable(payload);
  if (!result.data?.url) throw new Error('Stripe no devolvio URL de pago.');
  return result.data.url;
};

export const createStripePortalSession = async (payload: PortalPayload): Promise<string> => {
  const callable = httpsCallable<PortalPayload, UrlResult>(functions, 'createStripePortalSession');
  const result = await callable(payload);
  if (!result.data?.url) throw new Error('Stripe no devolvio URL de portal.');
  return result.data.url;
};

export const getStripeBillingUsage = async (payload: PortalPayload): Promise<number | null> => {
  const callable = httpsCallable<PortalPayload, BillingUsageResult>(
    functions,
    'getStripeBillingUsage'
  );
  const result = await callable(payload);
  return typeof result.data?.activeUsersCount === 'number'
    ? result.data.activeUsersCount
    : null;
};
