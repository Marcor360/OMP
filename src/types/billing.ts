export type BillingPlanKey = 'omp_80' | 'omp_150' | 'omp_250';

export type BillingStatus =
  | 'disabled'
  | 'checkout_pending'
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'payment_action_required'
  | 'unpaid'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'exempt'
  | string;

export type CongregationBillingState = {
  enabled: boolean;
  provider?: 'stripe' | 'exempt' | string;
  status: BillingStatus;
  billingDay?: number;
  billingCycle?: 'monthly' | string;
  planKey?: BillingPlanKey;
  activeUsersLimit?: number;
  userLimit?: number;
  stripePriceId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodStart?: unknown;
  currentPeriodEnd?: unknown;
  nextPaymentDate?: unknown;
  graceDays?: number;
  graceStartedAt?: unknown;
  graceUntil?: unknown;
  adminRestricted?: boolean;
  cancelAtPeriodEnd?: boolean;
  lastPaymentStatus?: string;
  lastInvoiceId?: string;
  lastInvoiceUrl?: string;
  lastStripeEventId?: string;
  updatedAt?: unknown;
};

export type BillingExemption = {
  exempt?: boolean;
  reason?: string;
  grantedBy?: string;
  grantedAt?: unknown;
  expiresAt?: unknown;
};

export const BILLING_PLAN_LABELS: Record<BillingPlanKey, string> = {
  omp_80: 'OMP 80',
  omp_150: 'OMP 120',
  omp_250: 'OMP 200',
};

export const BILLING_PLAN_LIMITS: Record<BillingPlanKey, number> = {
  omp_80: 80,
  omp_150: 120,
  omp_250: 200,
};

export const BILLING_PLAN_PRICES_MXN: Record<BillingPlanKey, number> = {
  omp_80: 70,
  omp_150: 120,
  omp_250: 200,
};

export const BILLING_PLANS: BillingPlanKey[] = ['omp_80', 'omp_150', 'omp_250'];
