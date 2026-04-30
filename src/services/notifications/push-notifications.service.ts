import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { serverTimestamp, setDoc } from 'firebase/firestore';

import { userPushTokenDocRef } from '@/src/lib/firebase/refs';
import { PermissionStatus } from '@/src/types/permissions.types';
import {
  canUseRemotePushNotifications,
  isExpoGo,
  isPhysicalDevice,
} from '@/src/utils/runtime';

type PushRegistrationFailureReason =
  | 'EXPO_GO_UNSUPPORTED'
  | 'WEB_UNSUPPORTED'
  | 'PHYSICAL_DEVICE_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'MISSING_PROJECT_ID'
  | 'UNKNOWN_ERROR';

export type PushNotificationRegistrationResult =
  | {
      ok: true;
      token: string;
    }
  | {
      ok: false;
      reason: PushRegistrationFailureReason;
      message: string;
    };

const DEFAULT_CHANNEL_ID = 'default';

const mapExpoStatus = (
  raw: 'granted' | 'denied' | 'undetermined' | string
): PermissionStatus => {
  switch (raw) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'undetermined':
      return 'undetermined';
    default:
      return 'unavailable';
  }
};

const resolveProjectId = (): string | null => {
  const easProjectId =
    ((Constants as { easConfig?: { projectId?: unknown } }).easConfig
      ?.projectId as unknown) ?? null;
  if (typeof easProjectId === 'string' && easProjectId.trim().length > 0) {
    return easProjectId.trim();
  }

  const extraProjectId =
    (
      (Constants as { expoConfig?: { extra?: { eas?: { projectId?: unknown } } } })
        .expoConfig?.extra?.eas?.projectId as unknown
    ) ?? null;
  if (typeof extraProjectId === 'string' && extraProjectId.trim().length > 0) {
    return extraProjectId.trim();
  }

  return null;
};

const tokenToDocId = (token: string): string =>
  encodeURIComponent(token).replace(/\./g, '%2E');

export const configureGlobalNotificationHandler = (): void => {
  if (!canUseRemotePushNotifications) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
};

export const ensureDefaultNotificationChannel = async (): Promise<void> => {
  if (Platform.OS !== 'android' || !canUseRemotePushNotifications) {
    return;
  }

  await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
    name: 'Notificaciones',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
};

export const getPushNotificationPermissionStatus =
  async (): Promise<PermissionStatus> => {
    if (!canUseRemotePushNotifications) {
      return 'unavailable';
    }

    try {
      const { status } = await Notifications.getPermissionsAsync();
      return mapExpoStatus(status);
    } catch {
      return 'unavailable';
    }
  };

export const requestPushNotificationPermission =
  async (): Promise<PermissionStatus> => {
    if (!canUseRemotePushNotifications) {
      return 'unavailable';
    }

    try {
      await ensureDefaultNotificationChannel();
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });

      return mapExpoStatus(status);
    } catch {
      return 'denied';
    }
  };

export const registerExpoPushTokenForUser = async (params: {
  userId: string | null;
  congregationId: string | null;
}): Promise<PushNotificationRegistrationResult> => {
  const userId = params.userId?.trim() ?? '';
  const congregationId = params.congregationId?.trim() ?? '';

  if (Platform.OS === 'web') {
    return {
      ok: false,
      reason: 'WEB_UNSUPPORTED',
      message: 'Las notificaciones push remotas no estan disponibles en web.',
    };
  }

  if (isExpoGo) {
    return {
      ok: false,
      reason: 'EXPO_GO_UNSUPPORTED',
      message:
        'Las notificaciones push remotas no estan disponibles en Expo Go. Usa una development build o release build.',
    };
  }

  if (!isPhysicalDevice || !Device.isDevice) {
    return {
      ok: false,
      reason: 'PHYSICAL_DEVICE_REQUIRED',
      message: 'Las notificaciones push remotas requieren un dispositivo fisico.',
    };
  }

  if (!userId || !congregationId) {
    return {
      ok: false,
      reason: 'UNKNOWN_ERROR',
      message: 'Falta userId o congregationId para registrar el token push.',
    };
  }

  try {
    await ensureDefaultNotificationChannel();

    const permission = await requestPushNotificationPermission();
    if (permission !== 'granted') {
      return {
        ok: false,
        reason: 'PERMISSION_DENIED',
        message: 'No se otorgo permiso para notificaciones push.',
      };
    }

    const projectId = resolveProjectId();
    if (!projectId) {
      return {
        ok: false,
        reason: 'MISSING_PROJECT_ID',
        message: 'No se encontro projectId de EAS para Expo Push Token.',
      };
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const token = tokenResponse.data?.trim();

    if (!token) {
      return {
        ok: false,
        reason: 'UNKNOWN_ERROR',
        message: 'No se pudo obtener Expo Push Token.',
      };
    }

    await setDoc(
      userPushTokenDocRef(userId, tokenToDocId(token)),
      {
        token,
        userId,
        congregationId,
        platform: Platform.OS,
        deviceName: Device.deviceName ?? Device.modelName ?? null,
        isActive: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return {
      ok: true,
      token,
    };
  } catch {
    return {
      ok: false,
      reason: 'UNKNOWN_ERROR',
      message: 'Error inesperado al registrar notificaciones push.',
    };
  }
};
