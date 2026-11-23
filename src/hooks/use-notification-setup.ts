/**
 * Initializes push notification behavior when user is authenticated.
 * It configures the foreground handler and only registers token if permission was granted.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useI18n } from '@/src/i18n/index';

import {
  clearDeliveredNotificationsAndBadge,
  configureNotificationHandler,
  syncNativeUnreadNotifications,
} from '@/src/services/notifications/notifications-service';
import { subscribeToUnreadNotificationsCount } from '@/src/services/notifications/notificationService';
import {
  registerExpoPushTokenForUser,
  startExpoPushTokenListener,
} from '@/src/services/notifications/push-notifications.service';
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
  const { language } = useI18n();
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
    let registering = false;
    let failures = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const tryRegisterPushToken = async () => {
      if (cancelled || registering || AppState.currentState === 'background') return;
      clearTimeout(retry);
      registering = true;
      try {
        const result = await registerExpoPushTokenForUser({ userId: uid, congregationId });
        if (result.ok) failures = 0;
        else if (!cancelled && result.reason === 'UNKNOWN_ERROR') {
          failures += 1;
          retry = setTimeout(() => void tryRegisterPushToken(), Math.min(60_000, 2_000 * 2 ** Math.min(failures, 5)));
        }
      } finally {
        registering = false;
      }
    };

    void tryRegisterPushToken();
    const unsubscribeTokenRotation = startExpoPushTokenListener(tryRegisterPushToken);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void tryRegisterPushToken();
    });
    const unsubscribeUnread = subscribeToUnreadNotificationsCount(
      uid,
      congregationId,
      (unreadCount) => {
        void syncNativeUnreadNotifications(unreadCount);
      },
      () => {
        void syncNativeUnreadNotifications(0);
      }
    );

    return () => {
      cancelled = true;
      clearTimeout(retry);
      appState.remove();
      unsubscribeUnread();
      unsubscribeTokenRotation();
    };
  }, [congregationId, isAuthenticated, language, uid]);
}
