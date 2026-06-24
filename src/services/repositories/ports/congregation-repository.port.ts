export interface CongregationRepository {
  getEmailDomainData(
    congregationId: string,
    options?: { forceServer?: boolean }
  ): Promise<Record<string, unknown> | null>;
  getDisplayNameData(
    congregationId: string,
    options?: { forceServer?: boolean }
  ): Promise<Record<string, unknown> | null>;
  getBillingPlanData(
    congregationId: string,
    options?: { forceServer?: boolean }
  ): Promise<Record<string, unknown> | null>;
  getPrivatePlanData(
    congregationId: string,
    options?: { forceServer?: boolean }
  ): Promise<Record<string, unknown> | null>;
  getAccessData(congregationId: string): Promise<Record<string, unknown> | null>;
  getSystemData(docId: string): Promise<Record<string, unknown> | null>;
}
