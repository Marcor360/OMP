import type {
  PreachingReportRepository,
  PreachingReportSubmissionRecord,
} from '@/src/services/repositories/ports/preaching-report-repository.port';
import {
  __resetPreachingReportRepositoryForTests,
  __setPreachingReportRepositoryForTests,
  getMissingPreachingReportsForManager,
  submitPreachingReport,
} from '@/src/services/preaching-report.service';
import type { AppUser } from '@/src/types/user';

const mockGetActiveUsers = jest.fn<Promise<AppUser[]>, [string]>();

jest.mock('@/src/services/repositories/firestore/firestore-preaching-report-repository', () => ({
  firestorePreachingReportRepository: {
    getSubmission: async () => null,
    listMonthlySubmissions: async () => [],
    upsertSubmission: async () => undefined,
  },
}));

jest.mock('@/src/lib/firebase/refs', () => ({
  preachingReportSubmissionDocRef: (congregationId: string, monthId: string, userId: string) => ({
    congregationId,
    monthId,
    userId,
  }),
}));

jest.mock('@/src/services/users/users-service', () => ({
  getActiveUsers: (congregationId: string) => mockGetActiveUsers(congregationId),
}));

const makeUser = (overrides: Partial<AppUser> = {}): AppUser => ({
  uid: 'user-1',
  email: 'user@example.com',
  displayName: 'User One',
  role: 'user',
  congregationId: 'cong-1',
  isActive: true,
  status: 'active',
  isElder: false,
  isMinisterialServant: false,
  ...overrides,
});

class FakePreachingReportRepository implements PreachingReportRepository {
  public submission: PreachingReportSubmissionRecord | null = null;
  public monthlySubmissions: PreachingReportSubmissionRecord[] = [];
  public upsertCalls: {
    congregationId: string;
    monthId: string;
    userId: string;
    payload: Record<string, unknown>;
    options?: { includeSubmittedAt?: boolean };
  }[] = [];

  async getSubmission(): Promise<PreachingReportSubmissionRecord | null> {
    return this.submission;
  }

  async listMonthlySubmissions(): Promise<PreachingReportSubmissionRecord[]> {
    return this.monthlySubmissions;
  }

  async upsertSubmission(
    congregationId: string,
    monthId: string,
    userId: string,
    payload: Record<string, unknown>,
    options?: { includeSubmittedAt?: boolean }
  ): Promise<void> {
    this.upsertCalls.push({ congregationId, monthId, userId, payload, options });
  }
}

describe('preaching-report service repository port', () => {
  let repo: FakePreachingReportRepository;

  beforeEach(() => {
    repo = new FakePreachingReportRepository();
    __setPreachingReportRepositoryForTests(repo);
    mockGetActiveUsers.mockResolvedValue([]);
  });

  afterEach(() => {
    __resetPreachingReportRepositoryForTests();
    mockGetActiveUsers.mockReset();
  });

  it('submits a preaching report through repository upsert with normalized payload', async () => {
    await submitPreachingReport({
      user: makeUser(),
      monthId: '2026-06',
      congregationName: 'Congregacion Centro',
      participated: true,
      bibleStudies: 2,
      returnVisits: 3,
      comments: '  Gracias  ',
      hours: 10,
    });

    expect(repo.upsertCalls).toHaveLength(1);
    expect(repo.upsertCalls[0]).toMatchObject({
      congregationId: 'cong-1',
      monthId: '2026-06',
      userId: 'user-1',
      options: { includeSubmittedAt: true },
    });
    expect(repo.upsertCalls[0]?.payload).toMatchObject({
      userId: 'user-1',
      userName: 'User One',
      congregationName: 'Congregacion Centro',
      monthName: 'junio de 2026',
      participated: true,
      bibleStudies: 2,
      returnVisits: 3,
      comments: 'Gracias',
      isPioneer: false,
      hours: null,
    });
  });

  it('computes missing preaching reports from active users minus submissions', async () => {
    mockGetActiveUsers.mockResolvedValue([
      makeUser({ uid: 'submitted', displayName: 'Submitted User' }),
      makeUser({ uid: 'missing', displayName: 'Missing User' }),
    ]);
    repo.monthlySubmissions = [
      {
        id: 'submitted',
        data: {
          userId: 'submitted',
          userName: 'Submitted User',
          monthId: '2026-06',
          monthName: 'junio de 2026',
          participated: true,
        },
      },
    ];

    const missing = await getMissingPreachingReportsForManager('cong-1', '2026-06');

    expect(missing).toEqual([
      {
        uid: 'missing',
        displayName: 'Missing User',
        privileges: undefined,
      },
    ]);
  });
});
