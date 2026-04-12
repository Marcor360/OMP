import { FieldValue } from 'firebase-admin/firestore';

export type NotificationCategory = 'platform' | 'cleaning' | 'hospitality';
export type MeetingType = 'midweek' | 'weekend' | null;

export interface NotificationMetadata {
  date?: string | null;
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
  read: boolean;
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
  congregationId: string | null;
  category: NotificationCategory;
  meetingType: MeetingType;
  date: string | null;
  sentBy: string | null;
}
