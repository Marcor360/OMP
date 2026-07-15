import { Timestamp } from 'firebase/firestore';

export type HospitalityScheduleStatus = 'draft' | 'published' | 'archived';
export type HospitalityAssignmentStatus = 'scheduled' | 'cancelled' | 'completed';

export type HospitalityMeetingType = 'midweek' | 'weekend';

export type HospitalityRoleKey =
  | 'chairman'
  | 'microphoneOne'
  | 'microphoneTwo'
  | 'microphoneThree'
  | 'attendantDoor'
  | 'attendantAuditorium'
  | 'attendantExtra'
  | 'watchtowerReader'
  | 'midweekBibleStudyReader'
  | 'audioVideo';

export interface HospitalityOptionalRoles {
  microphoneThree: boolean;
  attendantExtra: boolean;
}

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
  optionalRoles?: HospitalityOptionalRoles;
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

