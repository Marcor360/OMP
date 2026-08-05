import type { Unsubscribe } from 'firebase/firestore';

export type { Unsubscribe };

export type NotificationRecord = {
  id: string;
  data: Record<string, unknown>;
};

export interface NotificationRepository {
  list(congregationId: string, userId: string): Promise<NotificationRecord[]>;
  subscribeUserNotifications(
    congregationId: string,
    userId: string,
    callback: (notifications: NotificationRecord[]) => void,
    onError?: (error: unknown) => void
  ): Unsubscribe;
  subscribeUnreadCount(
    congregationId: string,
    userId: string,
    callback: (notifications: NotificationRecord[]) => void,
    onError?: (error: unknown) => void
  ): Unsubscribe;
  markAsRead(congregationId: string, notificationId: string): Promise<void>;
  markAllAsRead(congregationId: string, userId: string): Promise<number>;
}
