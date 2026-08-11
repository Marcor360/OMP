import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';

import {
  getPushNotificationPermissionStatus,
  registerExpoPushTokenForUser,
  requestPushNotificationPermission,
} from '@/src/services/notifications/push-notifications.service';
import { canUseRemotePushNotifications } from '@/src/utils/runtime';
import { useI18n } from '@/src/i18n/index';
import { confirmAlert } from '@/src/utils/ui/alerts';

const STARTUP_PERMISSION_PROMPT_KEY = '@omp/startup-permission-prompt-v1';

type StartupPromptFlag = 'accepted' | 'declined_once' | 'exhausted';

const parseStartupPromptFlag = (value: string | null): StartupPromptFlag | null => {
  if (value === 'accepted' || value === 'declined_once' || value === 'exhausted') {
    return value;
  }
  return null;
};

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
      const flag = parseStartupPromptFlag(await AsyncStorage.getItem(userPromptKey));
      const status = await getPushNotificationPermissionStatus();

      if (cancelled) {
        return;
      }

      // Ya concedido: garantizar que el flag y el token estén al día. Idempotente.
      if (status === 'granted') {
        if (flag !== 'accepted') {
          await AsyncStorage.setItem(userPromptKey, 'accepted');
        }
        void registerExpoPushTokenForUser({ userId: uid, congregationId });
        return;
      }

      // El sistema ya lo negó: no hay diálogo que mostrar, solo el camino a Ajustes,
      // y solo una vez (evita re-preguntar en cada sesión).
      if (status === 'denied') {
        if (flag !== 'exhausted') {
          await AsyncStorage.setItem(userPromptKey, 'exhausted');
          promptedThisSession.current = true;

          const shouldOpenSettings = await confirmAlert({
            title: t('permission.startup.deniedTitle'),
            message: t('permission.startup.deniedDescription'),
            confirmLabel: t('permission.action.openSettings'),
            cancelLabel: t('permission.startup.notNow'),
          });
          if (shouldOpenSettings) await Linking.openSettings();
        }
        return;
      }

      // status === 'undetermined'
      // 'exhausted' ya agotó sus intentos. 'accepted' con estado undetermined es un caso
      // raro (reinstalación del SO) y se trata como si no hubiera flag.
      if (flag === 'exhausted') {
        return;
      }

      promptedThisSession.current = true;

      const shouldRequestPermission = await confirmAlert({
        title: t('permission.startup.title'),
        message: t('permission.startup.description'),
        confirmLabel: t('permission.action.allow'),
        cancelLabel: t('permission.startup.notNow'),
      });

      if (!shouldRequestPermission) {
        await AsyncStorage.setItem(
          userPromptKey,
          flag === 'declined_once' ? 'exhausted' : 'declined_once'
        );
        return;
      }

      const result = await requestPushNotificationPermission();

      if (result === 'granted') {
        await AsyncStorage.setItem(userPromptKey, 'accepted');
        await registerExpoPushTokenForUser({ userId: uid, congregationId });
        return;
      }

      if (result === 'denied') {
        await AsyncStorage.setItem(userPromptKey, 'exhausted');
      }
    };

    void maybePrompt();

    return () => {
      cancelled = true;
    };
  }, [congregationId, isAuthenticated, t, uid]);
}
