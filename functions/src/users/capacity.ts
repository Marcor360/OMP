import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { PLAN_LIMITS } from './constants.js';
import type { BillingPlanKey } from './types.js';

export const isBillingPlanKey = (value: unknown): value is BillingPlanKey =>
  value === 'omp_80' || value === 'omp_150' || value === 'omp_250';

export const normalizePlanKey = (value: unknown): BillingPlanKey => {
  if (isBillingPlanKey(value)) return value;
  if (value === 'complete') return 'omp_250';
  if (value === 'intermediate') return 'omp_150';
  if (value === 'basic') return 'omp_80';
  return 'omp_80';
};

export const normalizePlanLimit = (value: unknown, fallbackPlanKey: BillingPlanKey): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return PLAN_LIMITS[fallbackPlanKey];
  }

  const normalized = Math.max(0, Math.floor(value));
  if (normalized === 70) return PLAN_LIMITS.omp_80;
  if (normalized === 80) return PLAN_LIMITS.omp_80;
  if (normalized === 120) return PLAN_LIMITS.omp_150;
  if (normalized === 150) return PLAN_LIMITS.omp_150;
  if (normalized === 200) return PLAN_LIMITS.omp_250;
  if (normalized === 250) return PLAN_LIMITS.omp_250;
  return normalized;
};

export const asPlainRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

export const resolvePlanKeyFromData = (
  congregationData: Record<string, unknown>,
  privatePlan: Record<string, unknown>
): BillingPlanKey => {
  const billing = asPlainRecord(congregationData.billing);
  return normalizePlanKey(
    billing?.planKey ??
      congregationData.planKey ??
      privatePlan.planKey ??
      privatePlan.planId
  );
};

export const resolveCongregationActiveUsersLimit = async (congregationId: string): Promise<number> => {
  const db = getFirestore();
  const congregationRef = db.collection('congregations').doc(congregationId);
  const [congregationSnap, privatePlanSnap] = await Promise.all([
    congregationRef.get(),
    congregationRef.collection('private').doc('plan').get(),
  ]);
  const congregationData = congregationSnap.exists
    ? congregationSnap.data() as Record<string, unknown>
    : {};
  const privatePlan = privatePlanSnap.exists ? privatePlanSnap.data() as Record<string, unknown> : {};
  const billing = asPlainRecord(congregationData.billing);
  const planKey = resolvePlanKeyFromData(congregationData, privatePlan);

  return normalizePlanLimit(
    billing?.activeUsersLimit ??
      billing?.userLimit ??
      congregationData.activeUsersLimit ??
      congregationData.userLimit ??
      privatePlan.activeUsersLimit ??
      privatePlan.userLimit,
    planKey
  );
};

export const assertCongregationHasUserCapacity = async (params: {
  congregationId: string;
  willCreateActiveUser: boolean;
}) => {
  if (!params.willCreateActiveUser) return;

  const db = getFirestore();
  const limitValue = await resolveCongregationActiveUsersLimit(params.congregationId);
  const activeUsersSnap = await db
    .collection('users')
    .where('congregationId', '==', params.congregationId)
    .where('isActive', '==', true)
    .limit(Math.max(limitValue + 1, 1))
    .get();

  if (activeUsersSnap.size >= limitValue) {
    throw new HttpsError(
      'resource-exhausted',
      `La congregacion alcanzo el limite de usuarios activos de su plan (${limitValue}).`
    );
  }
};
