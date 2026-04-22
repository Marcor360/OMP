/**
 * Initializes push notification behavior when user is authenticated.
 * It configures the foreground handler once and periodically retries token registration.
 */
import { useEffect } from 'react';

import {
  configureNotificationHandler,
  registerPushTokenForUser,
} from '@/src/services/notifications/notifications-service';

interface UseNotificationSetupOptions {
  uid: string | null;
  isAuthenticated: boolean;
}

const RETRY_INTERVAL_MS = 5 * 60 * 1000;

export function useNotificationSetup({ uid, isAuthenticated }: UseNotificationSetupOptions): void {
  useEffect(() => {
    configureNotificationHandler();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !uid) {
      return;
    }

    const runRegistration = () => {
      void registerPushTokenForUser(uid);
    };

    // Immediate attempt on auth.
    runRegistration();

    // Periodic retries in case permission was granted later.
    const timer = setInterval(runRegistration, RETRY_INTERVAL_MS);

    return () => {
      clearInterval(timer);
    };
  }, [isAuthenticated, uid]);
}
