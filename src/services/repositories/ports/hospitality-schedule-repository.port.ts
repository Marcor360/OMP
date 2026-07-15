import type {
  HospitalityOptionalRoles,
  HospitalitySchedule,
  HospitalityScheduleItem,
} from '@/src/types/hospitality-microphones';

export type EnsurePlanningMeetingsParams = {
  congregationId: string;
  startDate: string;
  endDate: string;
  midweekDay: number;
  weekendDay: number;
};

export type EnsurePlanningMeetingsResult = {
  createdMidweek: number;
  createdWeekend: number;
  existing: number;
};

export interface HospitalityScheduleRepository {
  ensurePlanningMeetings(
    params: EnsurePlanningMeetingsParams
  ): Promise<EnsurePlanningMeetingsResult>;
  listSchedules(congregationId: string): Promise<HospitalitySchedule[]>;
  listPublishedSchedules(congregationId: string): Promise<HospitalitySchedule[]>;
  listScheduleItems(congregationId: string, scheduleId: string): Promise<HospitalityScheduleItem[]>;
  listScheduledItemsForDateAndType(params: {
    congregationId: string;
    scheduleId: string;
    meetingDate: string;
    meetingType: 'midweek' | 'weekend';
  }): Promise<HospitalityScheduleItem[]>;
  addSchedule(params: {
    congregationId: string;
    title: string;
    startDate: string;
    endDate: string;
    monthIds: string[];
    totalMeetings: number;
    actorUid: string;
    optionalRoles?: HospitalityOptionalRoles;
  }): Promise<string>;
  updateScheduleOptionalRoles(params: {
    congregationId: string;
    scheduleId: string;
    optionalRoles: HospitalityOptionalRoles;
    actorUid: string;
  }): Promise<void>;
  archiveSchedule(params: {
    congregationId: string;
    scheduleId: string;
    actorUid: string;
  }): Promise<void>;
  upsertScheduleItems(params: {
    congregationId: string;
    scheduleId: string;
    items: Omit<HospitalityScheduleItem, 'id' | 'createdAt' | 'updatedAt'>[];
    actorUid: string;
  }): Promise<void>;
  publishSchedule(params: {
    congregationId: string;
    scheduleId: string;
    syncMeetings?: boolean;
  }): Promise<{ syncedMeetings: number; missingMeetings: number }>;
  substituteAssignment(params: {
    congregationId: string;
    scheduleId: string;
    itemId: string;
    newUserId: string;
  }): Promise<{ meetingSynced: boolean }>;
}
