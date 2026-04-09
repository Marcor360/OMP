import { Timestamp } from 'firebase/firestore';

export type MeetingStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type MeetingType = 'internal' | 'external' | 'review' | 'training';

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  type: MeetingType;
  status: MeetingStatus;
  startDate: Timestamp;
  endDate: Timestamp;
  location?: string;
  meetingUrl?: string;
  organizerUid: string;
  organizerName: string;
  attendees: string[];
  attendeeNames?: string[];
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateMeetingDTO {
  title: string;
  description?: string;
  type: MeetingType;
  startDate: Timestamp;
  endDate: Timestamp;
  location?: string;
  meetingUrl?: string;
  attendees: string[];
}

export interface UpdateMeetingDTO {
  title?: string;
  description?: string;
  type?: MeetingType;
  status?: MeetingStatus;
  startDate?: Timestamp;
  endDate?: Timestamp;
  location?: string;
  meetingUrl?: string;
  attendees?: string[];
  notes?: string;
}

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: 'Programada',
  in_progress: 'En progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  internal: 'Interna',
  external: 'Externa',
  review: 'Revisión',
  training: 'Capacitación',
};
