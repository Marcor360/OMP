import { Timestamp } from 'firebase/firestore';

export type CleaningScheduleStatus = 'draft' | 'published' | 'archived';
export type CleaningScheduleItemStatus = 'scheduled' | 'cancelled' | 'completed';

export type CleaningScheduleMeetingType = 'midweek' | 'weekend';

export interface CleaningSchedule {
  id: string;
  congregationId: string;
  title: string;
  startDate: string;
  endDate: string;
  monthIds: string[];
  totalMeetings: number;
  status: CleaningScheduleStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt?: Timestamp;
}

export interface CleaningScheduleItem {
  id: string;
  congregationId: string;
  scheduleId: string;
  meetingId?: string;
  meetingDate: string;
  meetingType: CleaningScheduleMeetingType;
  cleaningGroupId: string;
  cleaningGroupName: string;
  status: CleaningScheduleItemStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

