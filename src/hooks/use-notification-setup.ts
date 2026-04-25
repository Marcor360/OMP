/**
 * Initializes push notification behavior when user is authenticated.
 * It configures the foreground handler and only registers token if permission was granted.
 */
import { useEffect } from 'react';

import {
  configureNotificationHandler,
  getNotificationPermissionStatus,
  registerPushTokenForUser,
} from '@/src/services/notifications/notifications-service';
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
      return;
    }

    let cancelled = false;

    const tryRegisterIfPermissionGranted = async () => {
      const status = await getNotificationPermissionStatus();
      if (status !== 'granted' || cancelled) {
        return;
      }

      await registerPushTokenForUser(uid);
    };

    void tryRegisterIfPermissionGranted();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, uid]);
}
