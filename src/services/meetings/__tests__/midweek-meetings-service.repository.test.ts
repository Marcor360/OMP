import { Timestamp } from 'firebase/firestore';

import type {
  MidweekMeetingRepository,
  Unsubscribe,
} from '@/src/services/repositories/ports/midweek-meeting-repository.port';
import {
  __resetMidweekMeetingRepositoryForTests,
  __setMidweekMeetingRepositoryForTests,
  createMidweekMeeting,
  getMidweekMeetingsByWeek,
  subscribeToMidweekMeetings,
  updateMidweekMeeting,
  type MidweekMeeting,
  type MidweekMeetingPayload,
} from '@/src/services/meetings/midweek-meetings-service';
import { createBaseMidweekSections } from '@/src/types/midweek-meeting';

const mockApplyPublishedPlanningToMeeting = jest.fn();
const mockCreateMeeting = jest.fn();

jest.mock('firebase/firestore', () => {
  class MockTimestamp {
    public readonly seconds: number;
    public readonly nanoseconds: number;
    private readonly date: Date;

    constructor(date: Date) {
      this.date = date;
      this.seconds = Math.floor(date.getTime() / 1000);
      this.nanoseconds = (date.getTime() % 1000) * 1_000_000;
    }

    static fromDate(date: Date): MockTimestamp {
      return new MockTimestamp(date);
    }

    static now(): MockTimestamp {
      return new MockTimestamp(new Date());
    }

    toDate(): Date {
      return new Date(this.date.getTime());
    }

    toMillis(): number {
      return this.date.getTime();
    }
  }

  return {
    Timestamp: MockTimestamp,
  };
});

jest.mock('@/src/services/repositories/firestore/firestore-midweek-meeting-repository', () => ({
  firestoreMidweekMeetingRepository: {
    getById: async () => null,
    getAllByCongregation: async () => [],
    getByRange: async () => [],
    create: async () => 'midweek-id',
    update: async () => undefined,
    subscribeToMidweekMeetings: () => () => undefined,
  },
}));

jest.mock('@/src/services/meetings/meeting-autofill-service', () => ({
  applyPublishedPlanningToMeeting: (...args: unknown[]) =>
    mockApplyPublishedPlanningToMeeting(...args),
}));

jest.mock('@/src/services/meetings/meetings-service', () => ({
  createMeeting: (...args: unknown[]) => mockCreateMeeting(...args),
}));

jest.mock('@/src/utils/logger', () => ({
  createLogger: () => ({
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

const futureDate = (daysFromNow: number): Date => {
  const value = new Date();
  value.setDate(value.getDate() + daysFromNow);
  value.setHours(19, 0, 0, 0);
  return value;
};

const timestampFromFuture = (daysFromNow: number) => Timestamp.fromDate(futureDate(daysFromNow));

const makePayload = (overrides: Partial<MidweekMeetingPayload> = {}): MidweekMeetingPayload => {
  const startDate = timestampFromFuture(7);
  const endDate = timestampFromFuture(7);

  return {
    title: 'Reunion de entre semana',
    weekLabel: 'Semana del 1 de enero',
    bibleReading: 'Job 1-2',
    startDate,
    endDate,
    meetingDate: startDate,
    midweekSections: createBaseMidweekSections(),
    ...overrides,
  };
};

class FakeMidweekMeetingRepository implements MidweekMeetingRepository {
  public rangeCalls: {
    congregationId: string;
    startDate: Date;
    endDate: Date;
    options?: { forceServer?: boolean; maxItems?: number };
  }[] = [];
  public createCalls: {
    congregationId: string;
    payload: Record<string, unknown>;
    options?: { requiresManager?: boolean };
  }[] = [];
  public updateCalls: {
    congregationId: string;
    id: string;
    payload: Record<string, unknown>;
    options?: { requiresManager?: boolean };
  }[] = [];
  public subscribeCalls: { congregationId: string }[] = [];

  async getById(): Promise<MidweekMeeting | null> {
    return null;
  }

  async getAllByCongregation(): Promise<MidweekMeeting[]> {
    return [];
  }

  async getByRange(
    congregationId: string,
    startDate: Date,
    endDate: Date,
    options?: { forceServer?: boolean; maxItems?: number }
  ): Promise<MidweekMeeting[]> {
    this.rangeCalls.push({ congregationId, startDate, endDate, options });
    return [];
  }

  async create(
    congregationId: string,
    payload: Record<string, unknown>,
    options?: { requiresManager?: boolean }
  ): Promise<string> {
    this.createCalls.push({ congregationId, payload, options });
    return 'created-midweek';
  }

  async update(
    congregationId: string,
    id: string,
    payload: Record<string, unknown>,
    options?: { requiresManager?: boolean }
  ): Promise<void> {
    this.updateCalls.push({ congregationId, id, payload, options });
  }

  subscribeToMidweekMeetings(
    congregationId: string,
    callback: (meetings: MidweekMeeting[]) => void
  ): Unsubscribe {
    this.subscribeCalls.push({ congregationId });
    callback([]);
    return () => undefined;
  }
}

describe('midweek-meetings-service repository port', () => {
  let repo: FakeMidweekMeetingRepository;

  beforeEach(() => {
    repo = new FakeMidweekMeetingRepository();
    __setMidweekMeetingRepositoryForTests(repo);
    mockApplyPublishedPlanningToMeeting.mockResolvedValue(null);
    mockCreateMeeting.mockResolvedValue('created-midweek');
  });

  afterEach(() => {
    __resetMidweekMeetingRepositoryForTests();
    mockApplyPublishedPlanningToMeeting.mockReset();
    mockCreateMeeting.mockReset();
  });

  it('routes creation through the guarded meeting service', async () => {
    await createMidweekMeeting('cong-1', makePayload(), {
      uid: 'user-1',
      displayName: 'User One',
    });

    expect(repo.createCalls).toHaveLength(0);
    expect(mockCreateMeeting).toHaveBeenCalledWith(
      'cong-1',
      expect.objectContaining({ type: 'midweek', meetingCategory: 'midweek' }),
      'user-1',
      'User One'
    );
  });

  it('delegates weekly range reads with forceServer and maxItems options', async () => {
    const startDate = futureDate(1);
    const endDate = futureDate(7);

    await getMidweekMeetingsByWeek('cong-1', startDate, endDate, {
      forceServer: true,
      maxItems: 25,
    });

    expect(repo.rangeCalls).toEqual([
      {
        congregationId: 'cong-1',
        startDate,
        endDate,
        options: { forceServer: true, maxItems: 25 },
      },
    ]);
  });

  it('delegates subscribe and guards empty congregation ids', () => {
    const callback = jest.fn<void, [MidweekMeeting[]]>();
    const onError = jest.fn<void, [unknown]>();

    subscribeToMidweekMeetings('cong-1', callback);
    subscribeToMidweekMeetings('', callback, onError);

    expect(repo.subscribeCalls).toEqual([{ congregationId: 'cong-1' }]);
    expect(callback).toHaveBeenCalledWith([]);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('delegates update with the normalized payload and actor uid', async () => {
    await updateMidweekMeeting('cong-1', 'meeting-1', makePayload(), 'user-1');

    expect(repo.updateCalls).toHaveLength(1);
    expect(repo.updateCalls[0]).toMatchObject({
      congregationId: 'cong-1',
      id: 'meeting-1',
      options: { requiresManager: true },
    });
    expect(repo.updateCalls[0]?.payload).toMatchObject({
      meetingCategory: 'midweek',
      type: 'midweek',
      updatedBy: 'user-1',
    });
  });
});
