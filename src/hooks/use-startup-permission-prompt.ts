import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
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

  useEffect(() => {
    if (!canUseRemotePushNotifications || !isAuthenticated || !uid || !congregationId) {
      return;
    }

    let cancelled = false;

    const maybePrompt = async () => {
      const alreadyExplained = await AsyncStorage.getItem(STARTUP_PERMISSION_PROMPT_KEY);
      const status = await getNotificationPermissionStatus();

      if (cancelled || alreadyExplained === '1' || status !== 'undetermined') {
        return;
      }

      Alert.alert(
        t('permission.startup.title'),
        t('permission.startup.description'),
        [
          {
            text: t('permission.startup.notNow'),
            style: 'cancel',
            onPress: () => {
              void AsyncStorage.setItem(STARTUP_PERMISSION_PROMPT_KEY, '1');
            },
          },
          {
            text: t('permission.action.allow'),
            onPress: () => {
              void (async () => {
                await AsyncStorage.setItem(STARTUP_PERMISSION_PROMPT_KEY, '1');
                const result = await requestNotificationPermission();

                if (result === 'granted') {
                  await registerExpoPushTokenForUser({ userId: uid, congregationId });
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
