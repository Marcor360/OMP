import { Timestamp } from 'firebase/firestore';

import { MidweekMeetingSection } from '@/src/types/midweek-meeting';

export type MeetingStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type MeetingCategory = 'general' | 'midweek';
export type MeetingType =
  | 'internal'
  | 'external'
  | 'review'
  | 'training'
  | 'midweek'
  | 'weekend';

export interface Meeting {
  id: string;
  congregationId?: string;
  meetingCategory?: MeetingCategory;
  title: string;
  description?: string;
  type: MeetingType;
  status: MeetingStatus;
  weekLabel?: string;
  bibleReading?: string;
  startDate: Timestamp;
  endDate: Timestamp;
  location?: string;
  meetingUrl?: string;
  organizerUid: string;
  organizerName: string;
  attendees: string[];
  attendeeNames?: string[];
  notes?: string;
  openingSong?: string;
  openingPrayer?: string;
  closingSong?: string;
  closingPrayer?: string;
  chairman?: string;
  midweekSections?: MidweekMeetingSection[];
  createdBy?: string;
  updatedBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateMeetingDTO {
  title: string;
  description?: string;
  type: MeetingType;
  meetingCategory?: MeetingCategory;
  status?: MeetingStatus;
  weekLabel?: string;
  bibleReading?: string;
  startDate: Timestamp;
  endDate: Timestamp;
  location?: string;
  meetingUrl?: string;
  attendees: string[];
  attendeeNames?: string[];
  notes?: string;
  openingSong?: string;
  openingPrayer?: string;
  closingSong?: string;
  closingPrayer?: string;
  chairman?: string;
  midweekSections?: MidweekMeetingSection[];
  createdBy?: string;
  updatedBy?: string;
}

export interface UpdateMeetingDTO {
  title?: string;
  description?: string;
  type?: MeetingType;
  meetingCategory?: MeetingCategory;
  status?: MeetingStatus;
  weekLabel?: string;
  bibleReading?: string;
  startDate?: Timestamp;
  endDate?: Timestamp;
  location?: string;
  meetingUrl?: string;
  attendees?: string[];
  attendeeNames?: string[];
  notes?: string;
  openingSong?: string;
  openingPrayer?: string;
  closingSong?: string;
  closingPrayer?: string;
  chairman?: string;
  midweekSections?: MidweekMeetingSection[];
  createdBy?: string;
  updatedBy?: string;
}

export const resolveMeetingCategory = (meeting: Pick<Meeting, 'meetingCategory' | 'type'>): MeetingCategory => {
  if (meeting.meetingCategory) return meeting.meetingCategory;
  return meeting.type === 'midweek' ? 'midweek' : 'general';
};

export const isMidweekMeeting = (meeting: Pick<Meeting, 'meetingCategory' | 'type'>): boolean =>
  resolveMeetingCategory(meeting) === 'midweek';

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  pending: 'Pendiente',
  scheduled: 'Programada',
  in_progress: 'En progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  internal: 'Fin de semana',
  external: 'Fin de semana',
  review: 'Fin de semana',
  training: 'Fin de semana',
  midweek: 'Entre semana',
  weekend: 'Fin de semana',
};
