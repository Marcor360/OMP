import type { CongregationRepository } from '@/src/services/repositories/ports/congregation-repository.port';
import {
  __resetCongregationRepositoryForTests,
  __setCongregationRepositoryForTests,
  getCongregationAccessState,
  getCongregationPlanUsage,
} from '@/src/services/congregations/congregations-service';
import type { AppUser } from '@/src/types/user';

const mockGetActiveUsers = jest.fn<Promise<AppUser[]>, [string]>();

jest.mock('@/src/services/repositories/firestore/firestore-congregation-repository', () => ({
  firestoreCongregationRepository: {
    getEmailDomainData: async () => null,
    getDisplayNameData: async () => null,
    getBillingPlanData: async () => null,
    getPrivatePlanData: async () => null,
    getAccessData: async () => null,
    getSystemData: async () => null,
  },
}));

jest.mock('@/src/services/users/users-service', () => ({
  getActiveUsers: (congregationId: string) => mockGetActiveUsers(congregationId),
}));

const makeUser = (uid: string): AppUser => ({
  uid,
  email: `${uid}@example.com`,
  displayName: `User ${uid}`,
  role: 'user',
  congregationId: 'cong-1',
  isActive: true,
  status: 'active',
  isElder: false,
  isMinisterialServant: false,
});

class FakeCongregationRepository implements CongregationRepository {
  public accessData: Record<string, unknown> | null = null;
  public systemDataById = new Map<string, Record<string, unknown> | null>();
  public billingPlanData: Record<string, unknown> | null = null;
  public privatePlanData: Record<string, unknown> | null = null;
  public calls: string[] = [];

  async getEmailDomainData(): Promise<Record<string, unknown> | null> {
    return null;
  }

  async getDisplayNameData(): Promise<Record<string, unknown> | null> {
    return null;
  }

  async getBillingPlanData(): Promise<Record<string, unknown> | null> {
    this.calls.push('billing');
    return this.billingPlanData;
  }

  async getPrivatePlanData(): Promise<Record<string, unknown> | null> {
    this.calls.push('private-plan');
    return this.privatePlanData;
  }

  async getAccessData(): Promise<Record<string, unknown> | null> {
    this.calls.push('access');
    return this.accessData;
  }

  async getSystemData(docId: string): Promise<Record<string, unknown> | null> {
    this.calls.push(`system:${docId}`);
    return this.systemDataById.get(docId) ?? null;
  }
}

describe('congregations-service repository port', () => {
  let repo: FakeCongregationRepository;

  beforeEach(() => {
    repo = new FakeCongregationRepository();
    __setCongregationRepositoryForTests(repo);
    mockGetActiveUsers.mockResolvedValue([]);
  });

  afterEach(() => {
    __resetCongregationRepositoryForTests();
    mockGetActiveUsers.mockReset();
  });

  it('builds access state from repository data and checks system documents first', async () => {
    repo.accessData = {
      displayName: 'Congregacion Centro',
      slug: 'centro',
      disabled: true,
      deactivationReason: 'payment_overdue',
    };

    const state = await getCongregationAccessState('cong-1');

    expect(repo.calls).toEqual([
      'access',
      'system:maintenance',
      'system:congregationAccess',
      'system:platform',
    ]);
    expect(state).toMatchObject({
      isBlocked: true,
      reason: 'payment_overdue',
      congregationId: 'cong-1',
      congregationName: 'Congregacion Centro',
      firebaseName: 'centro',
      source: 'congregation',
    });
  });

  it('builds plan usage from congregation plan data and active user count', async () => {
    repo.billingPlanData = {
      billing: {
        planKey: 'omp_150',
        activeUsersLimit: 120,
      },
    };
    mockGetActiveUsers.mockResolvedValue([makeUser('one'), makeUser('two')]);

    const usage = await getCongregationPlanUsage('cong-1', { forceServer: true });

    expect(repo.calls).toEqual(['billing', 'private-plan']);
    expect(mockGetActiveUsers).toHaveBeenCalledWith('cong-1');
    expect(usage).toMatchObject({
      congregationId: 'cong-1',
      planId: 'omp_150',
      activeUsersLimit: 150,
      activeUsersCount: 2,
      remainingActiveUsers: 148,
    });
  });
});
