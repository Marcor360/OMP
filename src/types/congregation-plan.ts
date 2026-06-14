import {
  BILLING_PLAN_LABELS,
  BILLING_PLAN_LIMITS,
  type BillingPlanKey,
} from '@/src/types/billing';

export type CongregationPlanId = BillingPlanKey;

export const CONGREGATION_PLAN_LIMITS = BILLING_PLAN_LIMITS;
export const CONGREGATION_PLAN_LABELS = BILLING_PLAN_LABELS;

export interface CongregationPlanUsage {
  congregationId: string;
  planId: CongregationPlanId;
  planLabel: string;
  activeUsersLimit: number;
  activeUsersCount: number;
  remainingActiveUsers: number;
}
