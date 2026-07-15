import type { HospitalityScheduleRepository } from '@/src/services/repositories/ports/hospitality-schedule-repository.port';
import {
  __resetHospitalityScheduleRepositoryForTests,
  __setHospitalityScheduleRepositoryForTests,
  ensurePlanningMeetings,
  getCurrentPublishedHospitalitySchedule,
  getHospitalitySchedules,
  publishHospitalitySchedule,
  saveHospitalityScheduleItems,
  substituteHospitalityAssignment,
} from '@/src/services/hospitality-microphones/hospitality-microphones-service';
import type {
  HospitalitySchedule,
  HospitalityScheduleItem,
} from '@/src/types/hospitality-microphones';

jest.mock(
  '@/src/services/repositories/firestore/firestore-hospitality-schedule-repository',
  () => ({
    firestoreHospitalityScheduleRepository: {
      ensurePlanningMeetings: async () => ({ createdMidweek: 0, createdWeekend: 0, existing: 0 }),
      listSchedules: async () => [],
      listPublishedSchedules: async () => [],
      listScheduleItems: async () => [],
      listScheduledItemsForDateAndType: async () => [],
      addSchedule: async () => 'sch-id',
      updateScheduleOptionalRoles: async () => undefined,
      archiveSchedule: async () => undefined,
      upsertScheduleItems: async () => undefined,
      publishSchedule: async () => ({ syncedMeetings: 0, missingMeetings: 0 }),
      substituteAssignment: async () => ({ meetingSynced: true }),
    },
  })
);

jest.mock('@/src/modules/assignments/services/outgoing-talks.service', () => ({
  getScheduledOutgoingTalksInRange: async () => [],
}));

jest.mock('@/src/services/users/active-users-service', () => ({
  getActiveCongregationUsers: async () => [],
}));

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
  public ensurePayload: Parameters<HospitalityScheduleRepository['ensurePlanningMeetings']>[0] | null = null;

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
  public schedules: HospitalitySchedule[] = [];
  public archivedScheduleIds: string[] = [];
  public publishResult = { syncedMeetings: 5, missingMeetings: 0 };

  async ensurePlanningMeetings(
    params: Parameters<HospitalityScheduleRepository['ensurePlanningMeetings']>[0]
  ): Promise<{ createdMidweek: number; createdWeekend: number; existing: number }> {
    this.ensurePayload = params;
    return { createdMidweek: 4, createdWeekend: 4, existing: 2 };
  }

  async listSchedules(): Promise<HospitalitySchedule[]> {
    return this.schedules;
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

  async updateScheduleOptionalRoles(): Promise<void> {
    return undefined;
  }

  async archiveSchedule(params: { scheduleId: string }): Promise<void> {
    this.archivedScheduleIds.push(params.scheduleId);
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

  public substitutePayload: {
    congregationId: string;
    scheduleId: string;
    itemId: string;
    newUserId: string;
  } | null = null;

  public substituteResult = { meetingSynced: true };

  async substituteAssignment(params: {
    congregationId: string;
    scheduleId: string;
    itemId: string;
    newUserId: string;
  }): Promise<{ meetingSynced: boolean }> {
    this.substitutePayload = params;
    return this.substituteResult;
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

  it('delegates meeting generation to the repository', async () => {
    const result = await ensurePlanningMeetings({
      congregationId: 'cong-1',
      startDate: '2026-01-01',
      endDate: '2026-02-28',
      midweekDay: 3,
      weekendDay: 0,
    });

    expect(repo.ensurePayload).toEqual({
      congregationId: 'cong-1',
      startDate: '2026-01-01',
      endDate: '2026-02-28',
      midweekDay: 3,
      weekendDay: 0,
    });
    expect(result).toEqual({ createdMidweek: 4, createdWeekend: 4, existing: 2 });
  });

  it('archives expired published schedules for managers and hides them', async () => {
    repo.schedules = [
      makeSchedule({ id: 'expired', endDate: '2026-01-31' }),
      makeSchedule({ id: 'current', startDate: '2026-02-01', endDate: '2026-02-28' }),
    ];

    const result = await getHospitalitySchedules('cong-1', {
      canManage: true,
      actorUid: 'uid-1',
      today: '2026-02-15',
    });

    expect(repo.archivedScheduleIds).toEqual(['expired']);
    expect(result.map((schedule) => schedule.id)).toEqual(['current']);
  });

  it('returns only the currently published schedule to readers', async () => {
    repo.publishedSchedules = [
      makeSchedule({ id: 'expired', endDate: '2026-01-31' }),
      makeSchedule({ id: 'current', startDate: '2026-02-01', endDate: '2026-02-28' }),
      makeSchedule({ id: 'future', startDate: '2026-03-01', endDate: '2026-03-31' }),
    ];

    const result = await getCurrentPublishedHospitalitySchedule('cong-1', '2026-02-15');

    expect(result?.id).toBe('current');
    expect(repo.archivedScheduleIds).toEqual([]);
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

  describe('substituteHospitalityAssignment', () => {
    it('passes the payload through to repo.substituteAssignment', async () => {
      const result = await substituteHospitalityAssignment({
        congregationId: 'cong-1',
        scheduleId: 'sch-1',
        itemId: 'item-1',
        newUserId: 'uid-9',
      });

      expect(repo.substitutePayload).toEqual({
        congregationId: 'cong-1',
        scheduleId: 'sch-1',
        itemId: 'item-1',
        newUserId: 'uid-9',
      });
      expect(result).toEqual({ meetingSynced: true });
    });

    it('rejects locally without calling the repository when a required field is missing', async () => {
      await expect(
        substituteHospitalityAssignment({
          congregationId: 'cong-1',
          scheduleId: 'sch-1',
          itemId: '',
          newUserId: 'uid-9',
        })
      ).rejects.toThrow();

      expect(repo.substitutePayload).toBeNull();
    });
  });
});
