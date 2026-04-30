/**
 * Initializes push notification behavior when user is authenticated.
 * It configures the foreground handler and only registers token if permission was granted.
 */
import { useEffect } from 'react';

import {
  clearDeliveredNotificationsAndBadge,
  configureNotificationHandler,
  syncNativeUnreadNotifications,
} from '@/src/services/notifications/notifications-service';
import { subscribeToUnreadNotificationsCount } from '@/src/services/notifications/notificationService';
import { registerExpoPushTokenForUser } from '@/src/services/notifications/push-notifications.service';
import { canUseRemotePushNotifications } from '@/src/utils/runtime';

interface UseNotificationSetupOptions {
  uid: string | null;
  congregationId: string | null;
  isAuthenticated: boolean;
}

export function useNotificationSetup({
  uid,
  congregationId,
  isAuthenticated,
}: UseNotificationSetupOptions): void {
  useEffect(() => {
    configureNotificationHandler();
  }, []);

  useEffect(() => {
    if (!canUseRemotePushNotifications) {
      return;
    }

    if (!isAuthenticated || !uid || !congregationId) {
      void clearDeliveredNotificationsAndBadge();
      return;
    }

    let cancelled = false;
    let unsubscribeUnread = () => {};

    const tryRegisterPushToken = async () => {
      if (cancelled) {
        return;
      }

      await registerExpoPushTokenForUser({
        userId: uid,
        congregationId,
      });
    };

    void tryRegisterPushToken();
    unsubscribeUnread = subscribeToUnreadNotificationsCount(
      uid,
      (unreadCount) => {
        void syncNativeUnreadNotifications(unreadCount);
      },
      () => {
        void syncNativeUnreadNotifications(0);
      }
    );

    return () => {
      cancelled = true;
      unsubscribeUnread();
    };
  }, [congregationId, isAuthenticated, uid]);
}
