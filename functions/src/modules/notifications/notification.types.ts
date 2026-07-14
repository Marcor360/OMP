import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export type NotificationCategory = 'platform' | 'cleaning' | 'hospitality';
export type MeetingType = 'midweek' | 'weekend' | null;

export interface NotificationMetadata {
  meetingDate?: Timestamp | null;
  meetingDateLabel?: string | null;
  /** Legacy temporal: leer para UI, no usar como valor cronológico. */
  date?: string | null;
  meetingId?: string | null;
  meetingType?: MeetingType;
  role?: string | null;
}

export interface NotificationDocument {
  userId: string;
  congregationId: string | null;
  type: 'assignment';
  category: NotificationCategory | null;
  title: string;
  body: string;
  assignmentId: string;
  /** Nombre canónico alineado con Firestore Security Rules (`isRead`). */
  isRead: boolean;
  createdAt: FieldValue;
  sentBy?: string | null;
  metadata?: NotificationMetadata;
}

export interface UserNotificationSettings {
  uid: string;
  congregationId: string | null;
  isActive: boolean;
  notificationTokens: string[];
  notificationsEnabled: boolean;
  platformNotifications: boolean;
  cleaningNotifications: boolean;
  hospitalityNotifications: boolean;
}

export interface ResolvedAssignmentUsers {
  userIds: Set<string>;
  roleByUserId: Map<string, string>;
}

export interface AssignmentNotificationContext {
  assignmentId: string;
  meetingId: string | null;
  congregationId: string | null;
  category: NotificationCategory;
  meetingType: MeetingType;
  meetingDate: Timestamp | null;
  meetingDateLabel: string | null;
  sentBy: string | null;
}
