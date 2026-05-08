export type CongregationPlanId = 'basic' | 'intermediate' | 'complete';

export const CONGREGATION_PLAN_LIMITS: Record<CongregationPlanId, number> = {
  basic: 70,
  intermediate: 120,
  complete: 200,
};

export const CONGREGATION_PLAN_LABELS: Record<CongregationPlanId, string> = {
  basic: 'OMP Basico',
  intermediate: 'OMP Intermedio',
  complete: 'OMP Completo',
};

export interface CongregationPlanUsage {
  congregationId: string;
  planId: CongregationPlanId;
  planLabel: string;
  activeUsersLimit: number;
  activeUsersCount: number;
  remainingActiveUsers: number;
}
