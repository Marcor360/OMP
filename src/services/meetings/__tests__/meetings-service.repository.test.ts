import { Timestamp } from 'firebase/firestore';

import type {
  Unsubscribe,
  MeetingRepository,
} from '@/src/services/repositories/ports/meeting-repository.port';
import {
  __resetMeetingRepositoryForTests,
  __setMeetingRepositoryForTests,
  createMeeting,
  getMeetingsByWeek,
  subscribeToMeetings,
} from '@/src/services/meetings/meetings-service';
import type {
  CreateMeetingDTO,
  Meeting,
} from '@/src/types/meeting';
import { createDefaultSectionsForMeetingType } from '@/src/types/meeting/program';
import { AppError } from '@/src/utils/errors/errors';

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
  }

  return {
    Timestamp: MockTimestamp,
  };
});

jest.mock('@/src/services/repositories/firestore/firestore-meeting-repository', () => ({
  firestoreMeetingRepository: {
    getById: async () => null,
    getAllByCongregation: async () => [],
    getByRange: async () => [],
    getByDateRangeMerged: async () => [],
    getByUser: async () => [],
    create: async () => 'meeting-id',
    update: async () => undefined,
    delete: async () => undefined,
    subscribeToMeetings: () => () => undefined,
  },
}));

jest.mock('@/src/services/meetings/meeting-autofill-service', () => ({
  applyPublishedPlanningToMeeting: async () => null,
}));

const futureDate = (daysFromNow: number): Date => {
  const value = new Date();
  value.setDate(value.getDate() + daysFromNow);
  value.setHours(10, 0, 0, 0);
  return value;
};

const timestampFromFuture = (daysFromNow: number) => Timestamp.fromDate(futureDate(daysFromNow));

const makeMeeting = (overrides: Partial<Meeting> = {}): Meeting => {
  const startDate = timestampFromFuture(7);
  const endDate = timestampFromFuture(7);

  return {
    id: 'meeting-1',
    title: 'Meeting',
    type: 'weekend',
    meetingCategory: 'weekend',
    publicationStatus: 'published',
    startDate,
    endDate,
    meetingDate: startDate,
    organizerUid: 'organizer-1',
    organizerName: 'Organizer',
    attendees: [],
    sections: createDefaultSectionsForMeetingType('weekend'),
    createdAt: startDate,
    updatedAt: startDate,
    ...overrides,
  };
};

const makeCreateDto = (overrides: Partial<CreateMeetingDTO> = {}): CreateMeetingDTO => {
  const startDate = timestampFromFuture(14);
  const endDate = timestampFromFuture(14);

  return {
    title: 'New meeting',
    type: 'weekend',
    meetingCategory: 'weekend',
    startDate,
    endDate,
    meetingDate: startDate,
    attendees: [],
    sections: createDefaultSectionsForMeetingType('weekend'),
    ...overrides,
  };
};

class FakeMeetingRepository implements MeetingRepository {
  public rangeMeetings: Meeting[] = [];
  public mergedMeetings: Meeting[] = [];
  public mergedError: unknown = null;
  public createCalls: {
    congregationId: string;
    payload: Record<string, unknown>;
    options?: { requiresManager?: boolean };
  }[] = [];
  public subscribeCalls: { congregationId: string }[] = [];

  async getById(): Promise<Meeting | null> {
    return null;
  }

  async getAllByCongregation(): Promise<Meeting[]> {
    return [];
  }

  async getByRange(): Promise<Meeting[]> {
    return this.rangeMeetings;
  }

  async getByDateRangeMerged(): Promise<Meeting[]> {
    if (this.mergedError) {
      throw this.mergedError;
    }

    return this.mergedMeetings;
  }

  async getByUser(): Promise<Meeting[]> {
    return [];
  }

  async create(
    congregationId: string,
    payload: Record<string, unknown>,
    options?: { requiresManager?: boolean }
  ): Promise<string> {
    this.createCalls.push({ congregationId, payload, options });
    return 'created-meeting';
  }

  async update(): Promise<void> {
    return undefined;
  }

  async delete(): Promise<void> {
    return undefined;
  }

  subscribeToMeetings(
    congregationId: string,
    callback: (meetings: Meeting[]) => void
  ): Unsubscribe {
    this.subscribeCalls.push({ congregationId });
    callback(this.rangeMeetings);
    return () => undefined;
  }
}

describe('meetings-service repository port', () => {
  let repo: FakeMeetingRepository;

  beforeEach(() => {
    repo = new FakeMeetingRepository();
    __setMeetingRepositoryForTests(repo);
  });

  afterEach(() => {
    __resetMeetingRepositoryForTests();
  });

  it('filters meetings by week using domain options after repository range reads', async () => {
    const weekendPublished = makeMeeting({ id: 'weekend-published' });
    const midweekPublished = makeMeeting({
      id: 'midweek-published',
      type: 'midweek',
      meetingCategory: 'midweek',
      sections: createDefaultSectionsForMeetingType('midweek'),
    });
    const weekendDraft = makeMeeting({
      id: 'weekend-draft',
      publicationStatus: 'draft',
    });
    repo.rangeMeetings = [weekendPublished, midweekPublished, weekendDraft];

    const defaultResult = await getMeetingsByWeek('cong-1', futureDate(1), futureDate(21));
    const withMidweek = await getMeetingsByWeek('cong-1', futureDate(1), futureDate(21), {
      includeMidweek: true,
    });
    const publishedOnly = await getMeetingsByWeek('cong-1', futureDate(1), futureDate(21), {
      includeMidweek: true,
      publicationStatus: 'published',
    });

    expect(defaultResult.map((meeting) => meeting.id)).toEqual([
      'weekend-published',
      'weekend-draft',
    ]);
    expect(withMidweek.map((meeting) => meeting.id)).toEqual([
      'weekend-published',
      'midweek-published',
      'weekend-draft',
    ]);
    expect(publishedOnly.map((meeting) => meeting.id)).toEqual([
      'weekend-published',
      'midweek-published',
    ]);
  });

  it('throws AppError before touching the repository when createMeeting receives an invalid range', async () => {
    const startDate = timestampFromFuture(10);
    const endDate = timestampFromFuture(9);

    await expect(
      createMeeting('cong-1', makeCreateDto({ startDate, endDate }), 'user-1', 'User One')
    ).rejects.toBeInstanceOf(AppError);

    expect(repo.createCalls).toHaveLength(0);
  });

  it('throws AppError before touching the repository when createMeeting receives a past date', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(10, 0, 0, 0);
    const pastTimestamp = Timestamp.fromDate(yesterday);

    await expect(
      createMeeting(
        'cong-1',
        makeCreateDto({ startDate: pastTimestamp, endDate: pastTimestamp, meetingDate: pastTimestamp }),
        'user-1',
        'User One'
      )
    ).rejects.toBeInstanceOf(AppError);

    expect(repo.createCalls).toHaveLength(0);
  });

  it('delegates createMeeting to manager transport when conflict lookup is permission denied', async () => {
    repo.mergedError = { code: 'permission-denied' };

    await createMeeting('cong-1', makeCreateDto(), 'user-1', 'User One');

    expect(repo.createCalls).toHaveLength(1);
    expect(repo.createCalls[0]).toMatchObject({
      congregationId: 'cong-1',
      options: { requiresManager: true },
    });
  });

  it('throws AppError when createMeeting finds an overlapping conflict of the same kind', async () => {
    repo.mergedMeetings = [
      makeMeeting({
        id: 'conflict-1',
        startDate: timestampFromFuture(14),
        endDate: timestampFromFuture(14),
        meetingDate: timestampFromFuture(14),
      }),
    ];

    await expect(
      createMeeting('cong-1', makeCreateDto(), 'user-1', 'User One')
    ).rejects.toBeInstanceOf(AppError);

    expect(repo.createCalls).toHaveLength(0);
  });

  it('guards empty subscribe congregation ids', async () => {
    const callback = jest.fn<void, [Meeting[]]>();
    const onError = jest.fn<void, [unknown]>();

    subscribeToMeetings('cong-1', callback);
    subscribeToMeetings('', callback, onError);

    expect(repo.subscribeCalls).toEqual([{ congregationId: 'cong-1' }]);
    expect(callback).toHaveBeenCalledWith([]);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});
