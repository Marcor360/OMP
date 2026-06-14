import { Timestamp } from 'firebase/firestore';

export type HospitalityScheduleStatus = 'draft' | 'published' | 'archived';
export type HospitalityAssignmentStatus = 'scheduled' | 'cancelled' | 'completed';

export type HospitalityMeetingType = 'midweek' | 'weekend';

export type HospitalityRoleKey =
  | 'microphoneOne'
  | 'microphoneTwo'
  | 'attendantDoor'
  | 'attendantAuditorium'
  | 'watchtowerReader'
  | 'midweekBibleStudyReader'
  | 'audioVideo';

export interface HospitalitySchedule {
  id: string;
  congregationId: string;
  title: string;
  startDate: string;
  endDate: string;
  monthIds: string[];
  totalMeetings: number;
  status: HospitalityScheduleStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt?: Timestamp;
}

export interface HospitalityScheduleItem {
  id: string;
  congregationId: string;
  scheduleId: string;
  meetingId?: string;
  meetingDate: string;
  meetingType: HospitalityMeetingType;
  roleKey: HospitalityRoleKey;
  roleLabel: string;
  userId: string;
  userNameSnapshot: string;
  status: HospitalityAssignmentStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

