import type { HospitalityScheduleRepository } from '@/src/services/repositories/ports/hospitality-schedule-repository.port';
import {
  __resetHospitalityScheduleRepositoryForTests,
  __setHospitalityScheduleRepositoryForTests,
  publishHospitalitySchedule,
  saveHospitalityScheduleItems,
} from '@/src/services/hospitality-microphones/hospitality-microphones-service';
import type {
  HospitalitySchedule,
  HospitalityScheduleItem,
} from '@/src/types/hospitality-microphones';

jest.mock(
  '@/src/services/repositories/firestore/firestore-hospitality-schedule-repository',
  () => ({
    firestoreHospitalityScheduleRepository: {
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

const makeSchedule = (overrides: Partial<HospitalitySchedule> = {}): HospitalitySchedule => ({
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

class FakeHospitalityScheduleRepository implements HospitalityScheduleRepository {
  public publishPayload: {
    congregationId: string;
    scheduleId: string;
    syncMeetings?: boolean;
  } | null = null;

  public upsertPayload: {
    congregationId: string;
    scheduleId: string;
    items: Omit<HospitalityScheduleItem, 'id' | 'createdAt' | 'updatedAt'>[];
    actorUid: string;
  } | null = null;

  public publishedSchedules: HospitalitySchedule[] = [];
  public publishResult = { syncedMeetings: 5, missingMeetings: 0 };

  async listSchedules(): Promise<HospitalitySchedule[]> {
    return [];
  }

  async listPublishedSchedules(): Promise<HospitalitySchedule[]> {
    return this.publishedSchedules;
  }

  async listScheduleItems(): Promise<HospitalityScheduleItem[]> {
    return [];
  }

  async listScheduledItemsForDateAndType(): Promise<HospitalityScheduleItem[]> {
    return [];
  }

  async addSchedule(): Promise<string> {
    return 'sch-id';
  }

  async upsertScheduleItems(params: {
    congregationId: string;
    scheduleId: string;
    items: Omit<HospitalityScheduleItem, 'id' | 'createdAt' | 'updatedAt'>[];
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

describe('hospitality-microphones-service repository port', () => {
  let repo: FakeHospitalityScheduleRepository;

  beforeEach(() => {
    repo = new FakeHospitalityScheduleRepository();
    __setHospitalityScheduleRepositoryForTests(repo);
  });

  afterEach(() => {
    __resetHospitalityScheduleRepositoryForTests();
  });

  describe('publishHospitalitySchedule', () => {
    it('delegates to repo.publishSchedule when no overlap exists', async () => {
      repo.publishedSchedules = [
        makeSchedule({ id: 'past', startDate: '2025-01-01', endDate: '2025-12-31' }),
      ];

      const result = await publishHospitalitySchedule({
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
      expect(result).toEqual({ syncedMeetings: 5, missingMeetings: 0 });
    });

    it('passes syncMeetings flag through to the repository', async () => {
      repo.publishedSchedules = [];

      await publishHospitalitySchedule({
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
        publishHospitalitySchedule({
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

  describe('saveHospitalityScheduleItems', () => {
    it('persists items via repo.upsertScheduleItems with the expected payload', async () => {
      const items: Omit<HospitalityScheduleItem, 'id' | 'createdAt' | 'updatedAt'>[] = [
        {
          congregationId: 'cong-1',
          scheduleId: 'sch-1',
          meetingDate: '2026-01-06',
          meetingType: 'midweek',
          roleKey: 'microphoneOne',
          roleLabel: 'Micrófono 1',
          userId: 'uid-2',
          userNameSnapshot: 'Juan López',
          status: 'scheduled',
          createdBy: 'uid-1',
          updatedBy: 'uid-1',
        },
        {
          congregationId: 'cong-1',
          scheduleId: 'sch-1',
          meetingDate: '2026-01-06',
          meetingType: 'midweek',
          roleKey: 'attendantDoor',
          roleLabel: 'Acomodador Puerta',
          userId: 'uid-3',
          userNameSnapshot: 'Pedro García',
          status: 'scheduled',
          createdBy: 'uid-1',
          updatedBy: 'uid-1',
        },
      ];

      await saveHospitalityScheduleItems({
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
