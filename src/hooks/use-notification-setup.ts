/**
 * Initializes push notification behavior when user is authenticated.
 * It configures the foreground handler and only registers token if permission was granted.
 */
import { useEffect } from 'react';

import {
  clearDeliveredNotificationsAndBadge,
  configureNotificationHandler,
  getNotificationPermissionStatus,
  registerPushTokenForUser,
  syncNativeUnreadNotifications,
} from '@/src/services/notifications/notifications-service';
import { subscribeToUnreadNotificationsCount } from '@/src/services/notifications/notificationService';
import { canUseRemotePushNotifications } from '@/src/utils/runtime';

interface UseNotificationSetupOptions {
  uid: string | null;
  isAuthenticated: boolean;
}

export function useNotificationSetup({ uid, isAuthenticated }: UseNotificationSetupOptions): void {
  useEffect(() => {
    configureNotificationHandler();
  }, []);

  useEffect(() => {
    if (!canUseRemotePushNotifications) {
      return;
    }

    if (!isAuthenticated || !uid) {
      void clearDeliveredNotificationsAndBadge();
      return;
    }

    let cancelled = false;
    let unsubscribeUnread = () => {};

    const tryRegisterIfPermissionGranted = async () => {
      const status = await getNotificationPermissionStatus();
      if (status !== 'granted' || cancelled) {
        return;
      }

      await registerPushTokenForUser(uid);
    };

    void tryRegisterIfPermissionGranted();
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
  }, [isAuthenticated, uid]);
}
