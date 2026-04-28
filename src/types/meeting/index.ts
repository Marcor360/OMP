import { Timestamp } from 'firebase/firestore';

import { MidweekMeetingSection } from '@/src/types/midweek-meeting';
import {
  MeetingProgramSection,
  MeetingPublicationStatus,
} from '@/src/types/meeting/program';

export type MeetingStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type MeetingCategory = 'general' | 'midweek' | 'weekend';
export type MeetingCleaningAssignmentMode = 'none' | 'selected' | 'all';
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
  publicationStatus?: MeetingPublicationStatus;
  weekLabel?: string;
  bibleReading?: string;
  startDate: Timestamp;
  endDate: Timestamp;
  meetingDate?: Timestamp;
  publishedAt?: Timestamp;
  location?: string;
  meetingUrl?: string;
  zoomMeetingId?: string;
  zoomPasscode?: string;
  organizerUid: string;
  organizerName: string;
  attendees: string[];
  attendeeNames?: string[];
  assignedUserIds?: string[];
  cleaningAssignmentMode?: MeetingCleaningAssignmentMode;
  cleaningGroupIds?: string[];
  cleaningGroupNames?: string[];
  searchableText?: string;
  notes?: string;
  openingSong?: string;
  openingPrayer?: string;
  closingSong?: string;
  closingPrayer?: string;
  chairman?: string;
  sections?: MeetingProgramSection[];
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
  publicationStatus?: MeetingPublicationStatus;
  weekLabel?: string;
  bibleReading?: string;
  startDate: Timestamp;
  endDate: Timestamp;
  meetingDate?: Timestamp;
  publishedAt?: Timestamp;
  location?: string;
  meetingUrl?: string;
  zoomMeetingId?: string;
  zoomPasscode?: string;
  attendees: string[];
  attendeeNames?: string[];
  assignedUserIds?: string[];
  cleaningAssignmentMode?: MeetingCleaningAssignmentMode;
  cleaningGroupIds?: string[];
  cleaningGroupNames?: string[];
  searchableText?: string;
  notes?: string;
  openingSong?: string;
  openingPrayer?: string;
  closingSong?: string;
  closingPrayer?: string;
  chairman?: string;
  sections?: MeetingProgramSection[];
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
  publicationStatus?: MeetingPublicationStatus;
  weekLabel?: string;
  bibleReading?: string;
  startDate?: Timestamp;
  endDate?: Timestamp;
  meetingDate?: Timestamp;
  publishedAt?: Timestamp;
  location?: string;
  meetingUrl?: string;
  zoomMeetingId?: string;
  zoomPasscode?: string;
  attendees?: string[];
  attendeeNames?: string[];
  assignedUserIds?: string[];
  cleaningAssignmentMode?: MeetingCleaningAssignmentMode;
  cleaningGroupIds?: string[];
  cleaningGroupNames?: string[];
  searchableText?: string;
  notes?: string;
  openingSong?: string;
  openingPrayer?: string;
  closingSong?: string;
  closingPrayer?: string;
  chairman?: string;
  sections?: MeetingProgramSection[];
  midweekSections?: MidweekMeetingSection[];
  createdBy?: string;
  updatedBy?: string;
}

export const resolveMeetingCategory = (meeting: Pick<Meeting, 'meetingCategory' | 'type'>): MeetingCategory => {
  if (meeting.meetingCategory) return meeting.meetingCategory;
  if (meeting.type === 'midweek') return 'midweek';
  if (meeting.type === 'weekend') return 'weekend';
  return 'general';
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

export const MEETING_PUBLICATION_STATUS_LABELS: Record<MeetingPublicationStatus, string> = {
  draft: 'Borrador',
  published: 'Publicada',
};
