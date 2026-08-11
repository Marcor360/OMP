import type { BillingPlanKey } from '@/src/types/billing';

export interface BillingRepository {
  getCongregationDoc(congregationId: string): Promise<Record<string, unknown> | null>;
  getPrivateBillingDoc(congregationId: string): Promise<Record<string, unknown> | null>;
  createCheckoutSession(payload: {
    congregationId: string;
    planKey: BillingPlanKey;
  }): Promise<string>;
  createPortalSession(payload: { congregationId: string }): Promise<string>;
  getBillingUsage(payload: { congregationId: string }): Promise<number | null>;
  setBillingExemption(payload: { exempt: boolean }): Promise<void>;
}
