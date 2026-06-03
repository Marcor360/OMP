import { markAllNotificationsAsRead as markAllInService } from '@/src/services/notifications/notificationService';

export const markAllNotificationsAsRead = async (
  uid: string,
  congregationId?: string | null
): Promise<void> => {
  await markAllInService(uid, congregationId);
};
