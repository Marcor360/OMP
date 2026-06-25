import type {
  CleaningSchedule,
  CleaningScheduleItem,
} from '@/src/types/cleaning-schedule';

export interface CleaningScheduleRepository {
  listSchedules(congregationId: string): Promise<CleaningSchedule[]>;
  listPublishedSchedules(congregationId: string): Promise<CleaningSchedule[]>;
  listScheduleItems(congregationId: string, scheduleId: string): Promise<CleaningScheduleItem[]>;
  listScheduledItemsForDateAndType(params: {
    congregationId: string;
    scheduleId: string;
    meetingDate: string;
    meetingType: 'midweek' | 'weekend';
  }): Promise<CleaningScheduleItem[]>;
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
    items: Omit<CleaningScheduleItem, 'id' | 'createdAt' | 'updatedAt'>[];
    actorUid: string;
  }): Promise<void>;
  publishSchedule(params: {
    congregationId: string;
    scheduleId: string;
    syncMeetings?: boolean;
  }): Promise<{ syncedMeetings: number; missingMeetings: number }>;
}
