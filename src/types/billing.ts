export type BillingPlanId = 'omp_80' | 'omp_150' | 'omp_250';

export type BillingStatus =
  | 'disabled'
  | 'checkout_pending'
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'unpaid'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | string;

export type CongregationBillingState = {
  enabled: boolean;
  status: BillingStatus;
  billingDay?: number;
  billingCycle?: 'monthly' | string;
  planId?: BillingPlanId;
  activeUsersLimit?: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodStart?: unknown;
  currentPeriodEnd?: unknown;
  nextPaymentDate?: unknown;
  cancelAtPeriodEnd?: boolean;
  updatedAt?: unknown;
};

export type BillingExemption = {
  exempt?: boolean;
  reason?: string;
};

export const BILLING_PLAN_LABELS: Record<BillingPlanId, string> = {
  omp_80: 'OMP 80',
  omp_150: 'OMP 150',
  omp_250: 'OMP 250',
};

export const BILLING_PLAN_LIMITS: Record<BillingPlanId, number> = {
  omp_80: 80,
  omp_150: 150,
  omp_250: 250,
};

export const BILLING_PLANS: BillingPlanId[] = ['omp_80', 'omp_150', 'omp_250'];
