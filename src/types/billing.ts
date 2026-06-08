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
  | string;

export type CongregationBillingState = {
  enabled: boolean;
  provider?: 'stripe' | string;
  status: BillingStatus;
  billingDay?: number;
  billingCycle?: 'monthly' | string;
  planKey?: BillingPlanKey;
  activeUsersLimit?: number;
  stripePriceId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodStart?: unknown;
  currentPeriodEnd?: unknown;
  nextPaymentDate?: unknown;
  cancelAtPeriodEnd?: boolean;
  lastPaymentStatus?: string;
  lastInvoiceUrl?: string;
  updatedAt?: unknown;
};

export type BillingExemption = {
  exempt?: boolean;
  reason?: string;
  grantedBy?: string;
  grantedAt?: unknown;
};

export const BILLING_PLAN_LABELS: Record<BillingPlanKey, string> = {
  omp_80: 'OMP 80',
  omp_150: 'OMP 150',
  omp_250: 'OMP 250',
};

export const BILLING_PLAN_LIMITS: Record<BillingPlanKey, number> = {
  omp_80: 80,
  omp_150: 150,
  omp_250: 250,
};

export const BILLING_PLAN_PRICES_MXN: Record<BillingPlanKey, number> = {
  omp_80: 70,
  omp_150: 120,
  omp_250: 200,
};

export const BILLING_PLANS: BillingPlanKey[] = ['omp_80', 'omp_150', 'omp_250'];
