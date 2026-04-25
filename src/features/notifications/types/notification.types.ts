import { Timestamp } from 'firebase/firestore';

export type NotificationType = 'assignment';

export type NotificationCategory = 'platform' | 'cleaning' | 'hospitality' | null;

export type NotificationMeetingType = 'midweek' | 'weekend' | null;

export interface AppNotification {
  id: string;
  userId: string;
  congregationId: string | null;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  body: string;
  assignmentId: string;
  /** Campo canónico alineado con Firestore Security Rules y Cloud Functions. */
  isRead: boolean;
  createdAt: Timestamp;
  sentBy?: string | null;
  metadata?: {
    date?: string | null;
    meetingType?: NotificationMeetingType;
    role?: string | null;
  };
}

export const NOTIFICATION_CATEGORY_LABELS: Record<Exclude<NotificationCategory, null>, string> = {
  platform: 'Plataforma',
  cleaning: 'Limpieza',
  hospitality: 'Hospitalidad',
};
