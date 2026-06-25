import type { CleaningScheduleRepository } from '@/src/services/repositories/ports/cleaning-schedule-repository.port';
import {
  __resetCleaningScheduleRepositoryForTests,
  __setCleaningScheduleRepositoryForTests,
  publishCleaningSchedule,
  saveCleaningScheduleItems,
} from '@/src/services/cleaning/cleaning-schedule-service';
import type {
  CleaningSchedule,
  CleaningScheduleItem,
} from '@/src/types/cleaning-schedule';

jest.mock(
  '@/src/services/repositories/firestore/firestore-cleaning-schedule-repository',
  () => ({
    firestoreCleaningScheduleRepository: {
      listSchedules: async () => [],
      listPublishedSchedules: async () => [],
      listScheduleItems: async () => [],
      listScheduledItemsForDateAndType: async () => [],
      addSchedule: async () => 'sch-id',
      upsertScheduleItems: async () => undefined,
      publishSchedule: async () => ({ syncedMeetings: 0, missingMeetings: 0 }),
    },
  })
);

const makeSchedule = (overrides: Partial<CleaningSchedule> = {}): CleaningSchedule => ({
  id: 'sch-1',
  congregationId: 'cong-1',
  title: 'Test',
  startDate: '2026-01-01',
  endDate: '2026-06-30',
  monthIds: ['2026-01'],
  totalMeetings: 4,
  status: 'published',
  createdBy: 'uid-1',
  updatedBy: 'uid-1',
  createdAt: null as never,
  updatedAt: null as never,
  ...overrides,
});

class FakeCleaningScheduleRepository implements CleaningScheduleRepository {
  public publishPayload: {
    congregationId: string;
    scheduleId: string;
    syncMeetings?: boolean;
  } | null = null;

  public upsertPayload: {
    congregationId: string;
    scheduleId: string;
    items: Omit<CleaningScheduleItem, 'id' | 'createdAt' | 'updatedAt'>[];
    actorUid: string;
  } | null = null;

  public publishedSchedules: CleaningSchedule[] = [];
  public publishResult = { syncedMeetings: 3, missingMeetings: 1 };

  async listSchedules(): Promise<CleaningSchedule[]> {
    return [];
  }

  async listPublishedSchedules(): Promise<CleaningSchedule[]> {
    return this.publishedSchedules;
  }

  async listScheduleItems(): Promise<CleaningScheduleItem[]> {
    return [];
  }

  async listScheduledItemsForDateAndType(): Promise<CleaningScheduleItem[]> {
    return [];
  }

  async addSchedule(): Promise<string> {
    return 'sch-id';
  }

  async upsertScheduleItems(params: {
    congregationId: string;
    scheduleId: string;
    items: Omit<CleaningScheduleItem, 'id' | 'createdAt' | 'updatedAt'>[];
    actorUid: string;
  }): Promise<void> {
    this.upsertPayload = params;
  }

  async publishSchedule(params: {
    congregationId: string;
    scheduleId: string;
    syncMeetings?: boolean;
  }): Promise<{ syncedMeetings: number; missingMeetings: number }> {
    this.publishPayload = params;
    return this.publishResult;
  }
}

describe('cleaning-schedule-service repository port', () => {
  let repo: FakeCleaningScheduleRepository;

  beforeEach(() => {
    repo = new FakeCleaningScheduleRepository();
    __setCleaningScheduleRepositoryForTests(repo);
  });

  afterEach(() => {
    __resetCleaningScheduleRepositoryForTests();
  });

  describe('publishCleaningSchedule', () => {
    it('delegates to repo.publishSchedule when no overlap exists', async () => {
      repo.publishedSchedules = [
        makeSchedule({ id: 'past', startDate: '2025-01-01', endDate: '2025-12-31' }),
      ];

      const result = await publishCleaningSchedule({
        congregationId: 'cong-1',
        scheduleId: 'sch-new',
        actorUid: 'uid-1',
        startDate: '2026-01-01',
        endDate: '2026-06-30',
      });

      expect(repo.publishPayload).toMatchObject({
        congregationId: 'cong-1',
        scheduleId: 'sch-new',
      });
      expect(result).toEqual({ syncedMeetings: 3, missingMeetings: 1 });
    });

    it('passes syncMeetings flag through to the repository', async () => {
      repo.publishedSchedules = [];

      await publishCleaningSchedule({
        congregationId: 'cong-1',
        scheduleId: 'sch-1',
        actorUid: 'uid-1',
        startDate: '2026-01-01',
        endDate: '2026-06-30',
        syncMeetings: true,
      });

      expect(repo.publishPayload).toMatchObject({ syncMeetings: true });
    });

    it('throws before calling repo when an overlapping published schedule exists', async () => {
      repo.publishedSchedules = [
        makeSchedule({ id: 'overlap', startDate: '2026-01-01', endDate: '2026-06-30' }),
      ];

      await expect(
        publishCleaningSchedule({
          congregationId: 'cong-1',
          scheduleId: 'sch-new',
          actorUid: 'uid-1',
          startDate: '2026-03-01',
          endDate: '2026-09-30',
        })
      ).rejects.toThrow();

      expect(repo.publishPayload).toBeNull();
    });
  });

  describe('saveCleaningScheduleItems', () => {
    it('persists items via repo.upsertScheduleItems with the expected payload', async () => {
      const items: Omit<CleaningScheduleItem, 'id' | 'createdAt' | 'updatedAt'>[] = [
        {
          congregationId: 'cong-1',
          scheduleId: 'sch-1',
          meetingDate: '2026-01-06',
          meetingType: 'midweek',
          cleaningGroupId: 'grp-1',
          cleaningGroupName: 'Grupo 1',
          status: 'scheduled',
          createdBy: 'uid-1',
          updatedBy: 'uid-1',
        },
        {
          congregationId: 'cong-1',
          scheduleId: 'sch-1',
          meetingDate: '2026-01-09',
          meetingType: 'weekend',
          cleaningGroupId: 'grp-2',
          cleaningGroupName: 'Grupo 2',
          status: 'scheduled',
          createdBy: 'uid-1',
          updatedBy: 'uid-1',
        },
      ];

      await saveCleaningScheduleItems({
        congregationId: 'cong-1',
        scheduleId: 'sch-1',
        items,
        actorUid: 'uid-1',
      });

      expect(repo.upsertPayload).toMatchObject({
        congregationId: 'cong-1',
        scheduleId: 'sch-1',
        items,
        actorUid: 'uid-1',
      });
    });
  });
});
