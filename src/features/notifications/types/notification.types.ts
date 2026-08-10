import { Timestamp } from 'firebase/firestore';

import type { AppTranslationKey } from '@/src/i18n/index';

export type NotificationType = 'assignment' | 'event' | 'billing';

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
  assignmentId?: string;
  eventId?: string;
  eventType?: string;
  /** Campo canónico alineado con Firestore Security Rules y Cloud Functions. */
  isRead: boolean;
  read: boolean;
  createdAt: Timestamp;
  sentBy?: string | null;
  metadata?: {
    date?: string | null;
    meetingDate?: Timestamp | null;
    meetingDateLabel?: string | null;
    meetingId?: string | null;
    meetingType?: NotificationMeetingType;
    role?: string | null;
    billingEvent?: string | null;
    daysUntilPayment?: number | null;
    nextPaymentDate?: string | null;
    invoiceId?: string | null;
    invoiceUrl?: string | null;
  };
  data?: {
    url?: string | null;
  };
}

export const NOTIFICATION_CATEGORY_LABELS: Record<
  Exclude<NotificationCategory, null>,
  AppTranslationKey
> = {
  platform: 'notifications.category.platform',
  cleaning: 'notifications.category.cleaning',
  hospitality: 'notifications.category.hospitality',
};

export const resolveNotificationBadgeKey = (notification: AppNotification): AppTranslationKey => {
  if (notification.type === 'event') return 'notifications.category.event';
  if (notification.type === 'billing') return 'notifications.category.billing';

  return notification.category
    ? NOTIFICATION_CATEGORY_LABELS[notification.category]
    : 'notifications.category.assignment';
};
