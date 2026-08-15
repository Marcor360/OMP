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
  currentPeriodStart?: unknown;
  currentPeriodEnd?: unknown;
  nextPaymentDate?: unknown;
  graceDays?: number;
  graceStartedAt?: unknown;
  graceUntil?: unknown;
  adminRestricted?: boolean;
  cancelAtPeriodEnd?: boolean;
  updatedAt?: unknown;
};

// SEC-01: identificadores internos de Stripe. Viven en
// congregations/{id}/private/billing (admin + quien puede ver facturacion),
// no en el documento raiz de la congregacion, que cualquier miembro activo
// puede leer.
export type CongregationPrivateBillingState = {
  stripePriceId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
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
