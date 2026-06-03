import { markNotificationAsRead as markInService } from '@/src/services/notifications/notificationService';

export const markNotificationAsRead = async (
  notificationId: string,
  congregationId?: string | null
): Promise<void> => {
  await markInService(notificationId, congregationId);
};
