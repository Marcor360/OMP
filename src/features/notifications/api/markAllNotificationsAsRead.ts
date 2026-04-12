import { markAllNotificationsAsRead as markAllInService } from '@/src/services/notifications/notificationService';

export const markAllNotificationsAsRead = async (uid: string): Promise<void> => {
  await markAllInService(uid);
};
