import { getUserNotifications as getFromService } from '@/src/services/notifications/notificationService';
import { AppNotification } from '@/src/features/notifications/types/notification.types';

export const getUserNotifications = async (uid: string): Promise<AppNotification[]> => {
  return getFromService(uid);
};
