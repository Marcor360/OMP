import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import {
  getPushNotificationPermissionStatus,
  registerExpoPushTokenForUser,
  requestPushNotificationPermission,
} from '@/src/services/notifications/push-notifications.service';
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
      const userPromptKey = `${STARTUP_PERMISSION_PROMPT_KEY}:${uid}`;
      const alreadyExplained = await AsyncStorage.getItem(userPromptKey);
      const status = await getPushNotificationPermissionStatus();

      if (cancelled || status !== 'undetermined') {
        return;
      }

      if (alreadyExplained === '1') {
        await AsyncStorage.removeItem(userPromptKey);
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
                const result = await requestPushNotificationPermission();

                if (result === 'granted') {
                  await AsyncStorage.setItem(userPromptKey, '1');
                  await registerExpoPushTokenForUser({ userId: uid, congregationId });
                  return;
                }

                if (result === 'denied') {
                  await AsyncStorage.setItem(userPromptKey, '1');
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
