import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
} from '@/src/services/notifications/notifications-service';
import { registerExpoPushTokenForUser } from '@/src/services/notifications/push-notifications.service';
import { canUseRemotePushNotifications } from '@/src/utils/runtime';
import { useI18n } from '@/src/i18n/index';

const STARTUP_PERMISSION_PROMPT_KEY = '@omp/startup-permission-prompt-v1';

type StartupPermissionPromptOptions = {
  uid: string | null;
  congregationId: string | null;
  isAuthenticated: boolean;
};

export function useStartupPermissionPrompt({
  uid,
  congregationId,
  isAuthenticated,
}: StartupPermissionPromptOptions): void {
  const { t } = useI18n();
  const promptedThisSession = useRef(false);

  useEffect(() => {
    if (
      promptedThisSession.current ||
      !canUseRemotePushNotifications ||
      !isAuthenticated ||
      !uid ||
      !congregationId
    ) {
      return;
    }

    let cancelled = false;

    const maybePrompt = async () => {
      const alreadyExplained = await AsyncStorage.getItem(STARTUP_PERMISSION_PROMPT_KEY);
      const status = await getNotificationPermissionStatus();

      if (cancelled || alreadyExplained === '1' || status !== 'undetermined') {
        return;
      }

      promptedThisSession.current = true;

      Alert.alert(
        t('permission.startup.title'),
        t('permission.startup.description'),
        [
          {
            text: t('permission.startup.notNow'),
            style: 'cancel',
          },
          {
            text: t('permission.action.allow'),
            onPress: () => {
              void (async () => {
                const result = await requestNotificationPermission();

                if (result === 'granted') {
                  await AsyncStorage.setItem(STARTUP_PERMISSION_PROMPT_KEY, '1');
                  await registerExpoPushTokenForUser({ userId: uid, congregationId });
                  return;
                }

                if (result === 'denied') {
                  await AsyncStorage.setItem(STARTUP_PERMISSION_PROMPT_KEY, '1');
                }
              })();
            },
          },
        ]
      );
    };

    void maybePrompt();

    return () => {
      cancelled = true;
    };
  }, [congregationId, isAuthenticated, t, uid]);
}
