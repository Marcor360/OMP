import { markNotificationAsRead as markInService } from '@/src/services/notifications/notificationService';

export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  await markInService(notificationId);
};
