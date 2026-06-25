import type {
  HospitalitySchedule,
  HospitalityScheduleItem,
} from '@/src/types/hospitality-microphones';

export interface HospitalityScheduleRepository {
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
  }): Promise<string>;
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
}
