import type {
  HospitalityMeetingType,
  HospitalityOptionalRoles,
  HospitalityRoleKey,
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

export type SaveHospitalityScheduleDraftItem = {
  meetingId: string;
  meetingDate: string;
  meetingType: HospitalityMeetingType;
  roleKey: HospitalityRoleKey;
  userId: string;
};

export type SaveHospitalityScheduleDraftParams = {
  congregationId: string;
  scheduleId?: string;
  title: string;
  startDate: string;
  endDate: string;
  optionalRoles: HospitalityOptionalRoles;
  items: SaveHospitalityScheduleDraftItem[];
};

export type DroppedHospitalityScheduleItem = {
  meetingDate: string;
  roleKey: string;
  userId: string;
  reason: string;
};

export type SaveHospitalityScheduleDraftResult = {
  scheduleId: string;
  created: boolean;
  savedItems: number;
  droppedItems: DroppedHospitalityScheduleItem[];
};

export type ArchiveHospitalityScheduleResult = {
  cancelledItems: number;
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
  saveDraft(
    params: SaveHospitalityScheduleDraftParams
  ): Promise<SaveHospitalityScheduleDraftResult>;
  archiveSchedule(params: {
    congregationId: string;
    scheduleId: string;
  }): Promise<ArchiveHospitalityScheduleResult>;
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
