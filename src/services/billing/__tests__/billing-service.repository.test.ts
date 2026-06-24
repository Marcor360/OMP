import type { BillingRepository } from '@/src/services/repositories/ports/billing-repository.port';
import {
  __resetBillingRepositoryForTests,
  __setBillingRepositoryForTests,
  createStripeCheckoutSession,
  getCongregationBillingSummary,
} from '@/src/services/billing/billing-service';
import type { BillingPlanKey } from '@/src/types/billing';

jest.mock('@/src/services/repositories/firestore/firestore-billing-repository', () => ({
  firestoreBillingRepository: {
    getCongregationDoc: async () => null,
    createCheckoutSession: async () => '',
    createPortalSession: async () => '',
    getBillingUsage: async () => null,
  },
}));

class FakeBillingRepository implements BillingRepository {
  public docData: Record<string, unknown> | null = null;
  public checkoutPayload: { congregationId: string; planKey: BillingPlanKey } | null = null;
  public checkoutUrl = 'https://checkout.stripe.com/session';

  async getCongregationDoc(congregationId: string): Promise<Record<string, unknown> | null> {
    void congregationId;
    return this.docData;
  }

  async createCheckoutSession(payload: {
    congregationId: string;
    planKey: BillingPlanKey;
  }): Promise<string> {
    this.checkoutPayload = payload;
    return this.checkoutUrl;
  }

  async createPortalSession(): Promise<string> {
    return 'https://portal.stripe.com/session';
  }

  async getBillingUsage(): Promise<number | null> {
    return null;
  }
}

describe('billing-service repository port', () => {
  let repo: FakeBillingRepository;

  beforeEach(() => {
    repo = new FakeBillingRepository();
    __setBillingRepositoryForTests(repo);
  });

  afterEach(() => {
    __resetBillingRepositoryForTests();
  });

  it('getCongregationBillingSummary returns null when doc does not exist', async () => {
    repo.docData = null;

    const result = await getCongregationBillingSummary('cong-1');

    expect(result).toBeNull();
  });

  it('getCongregationBillingSummary builds summary from raw doc data', async () => {
    repo.docData = {
      billing: {
        enabled: true,
        status: 'active',
        planKey: 'omp_80',
      },
    };

    const result = await getCongregationBillingSummary('cong-1');

    expect(result).not.toBeNull();
    expect(result?.congregationId).toBe('cong-1');
    expect(result?.billing.enabled).toBe(true);
    expect(result?.billing.status).toBe('active');
    expect(result?.billing.planKey).toBe('omp_80');
  });

  it('getCongregationBillingSummary overrides billing fields when exempt', async () => {
    repo.docData = {
      billing: { enabled: false, status: 'disabled' },
      billingExemption: { exempt: true, reason: 'internal' },
    };

    const result = await getCongregationBillingSummary('cong-1');

    expect(result?.billing.enabled).toBe(true);
    expect(result?.billing.provider).toBe('exempt');
    expect(result?.billing.status).toBe('exempt');
    expect(result?.billing.adminRestricted).toBe(false);
    expect(result?.billingExemption?.exempt).toBe(true);
  });

  it('getCongregationBillingSummary returns null for empty congregationId', async () => {
    const result = await getCongregationBillingSummary('   ');

    expect(result).toBeNull();
  });

  it('createStripeCheckoutSession delegates and returns URL', async () => {
    const url = await createStripeCheckoutSession({
      congregationId: 'cong-1',
      planKey: 'omp_150',
    });

    expect(url).toBe('https://checkout.stripe.com/session');
    expect(repo.checkoutPayload).toMatchObject({
      congregationId: 'cong-1',
      planKey: 'omp_150',
    });
  });
});
