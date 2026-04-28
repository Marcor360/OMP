/**
 * Push notification service.
 * Handles permission checks, token registration in Firestore,
 * and local notifications for in-app reminders.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  arrayRemove,
  arrayUnion,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import { userDocRef } from '@/src/lib/firebase/refs';
import { PermissionStatus } from '@/src/types/permissions.types';
import {
  canUseRemotePushNotifications,
  isExpoGo,
  isPhysicalDevice,
} from '@/src/utils/runtime';

type NotificationsModule = typeof import('expo-notifications');

type PushRegistrationFailureReason =
  | 'EXPO_GO_UNSUPPORTED'
  | 'WEB_UNSUPPORTED'
  | 'PHYSICAL_DEVICE_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'MISSING_PROJECT_ID'
  | 'UNKNOWN_ERROR';

export type PushRegistrationResult =
  | {
      ok: true;
      token: string;
    }
  | {
      ok: false;
      reason: PushRegistrationFailureReason;
      message: string;
    };

export interface LocalNotificationOptions {
  title: string;
  body: string;
  channelId?: string;
  data?: Record<string, unknown>;
  delaySeconds?: number;
}

type PushTokenSubscription = { remove: () => void };

const NOOP = () => {};
const EXPO_GO_UNSUPPORTED_MESSAGE =
  'Las notificaciones push remotas no estan disponibles en Expo Go. Usa una development build.';
const WEB_UNSUPPORTED_MESSAGE =
  'Las notificaciones push remotas no estan disponibles en web.';
const PHYSICAL_DEVICE_REQUIRED_MESSAGE =
  'Las notificaciones push remotas requieren un dispositivo fisico.';

let notificationsModulePromise: Promise<NotificationsModule | null> | null =
  null;
let notificationHandlerConfigured = false;

const loadNotificationsModule = async (): Promise<NotificationsModule | null> => {
  if (!canUseRemotePushNotifications) {
    return null;
  }

  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications')
      .then((module) => module)
      .catch(() => null);
  }

  return notificationsModulePromise;
};

const resolveProjectId = (): string | null => {
  const easProjectId =
    ((Constants as { easConfig?: { projectId?: unknown } }).easConfig
      ?.projectId as unknown) ?? null;
  if (typeof easProjectId === 'string' && easProjectId.trim().length > 0) {
    return easProjectId.trim();
  }

  const expoExtraProjectId =
    (
      (Constants as { expoConfig?: { extra?: { eas?: { projectId?: unknown } } } })
        .expoConfig?.extra?.eas?.projectId as unknown
    ) ?? null;
  if (
    typeof expoExtraProjectId === 'string' &&
    expoExtraProjectId.trim().length > 0
  ) {
    return expoExtraProjectId.trim();
  }

  return null;
};

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

const ensureAndroidChannels = async (
  Notifications: NotificationsModule
): Promise<void> => {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'General',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2563EB',
    sound: 'default',
  });

  await Notifications.setNotificationChannelAsync('cleaning', {
    name: 'Limpieza',
    description: 'Notificaciones del modulo de grupos de limpieza',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 100, 200],
    lightColor: '#16A34A',
    sound: 'default',
  });
};

const getNativeDevicePushToken = async (
  Notifications: NotificationsModule
): Promise<string | null> => {
  try {
    const tokenData = await Notifications.getDevicePushTokenAsync();
    return typeof tokenData.data === 'string' && tokenData.data.trim().length > 0
      ? tokenData.data.trim()
      : null;
  } catch {
    return null;
  }
};

export function configureNotificationHandler(): void {
  if (!canUseRemotePushNotifications || notificationHandlerConfigured) {
    return;
  }

  void (async () => {
    const Notifications = await loadNotificationsModule();
    if (!Notifications || notificationHandlerConfigured) {
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

    notificationHandlerConfigured = true;
  })();
}

export const startPushTokenListener = (
  callback: (token: string) => void
): (() => void) => {
  if (!canUseRemotePushNotifications) {
    return NOOP;
  }

  let disposed = false;
  let unsubscribe: () => void = NOOP;

  void (async () => {
    const Notifications = await loadNotificationsModule();
    if (!Notifications || disposed) {
      return;
    }

    const addListener = (
      Notifications as unknown as {
        addPushTokenListener?: (
          cb: (event: { data?: unknown }) => void
        ) => PushTokenSubscription;
      }
    ).addPushTokenListener;

    if (typeof addListener !== 'function') {
      return;
    }

    const subscription = addListener((event) => {
      if (typeof event?.data === 'string' && event.data.trim().length > 0) {
        callback(event.data.trim());
      }
    });

    unsubscribe = () => {
      subscription.remove();
    };
  })();

  return () => {
    disposed = true;
    unsubscribe();
  };
};

export async function getNotificationPermissionStatus(): Promise<PermissionStatus> {
  if (!canUseRemotePushNotifications) {
    return 'unavailable';
  }

  const Notifications = await loadNotificationsModule();
  if (!Notifications) {
    return 'unavailable';
  }

  try {
    const { status } = await Notifications.getPermissionsAsync();
    return mapExpoStatus(status);
  } catch {
    return 'unavailable';
  }
}

export async function requestNotificationPermission(): Promise<PermissionStatus> {
  if (!canUseRemotePushNotifications) {
    return 'unavailable';
  }

  const Notifications = await loadNotificationsModule();
  if (!Notifications) {
    return 'unavailable';
  }

  try {
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
}

export async function registerForPushNotificationsAsync(): Promise<PushRegistrationResult> {
  if (Platform.OS === 'web') {
    return {
      ok: false,
      reason: 'WEB_UNSUPPORTED',
      message: WEB_UNSUPPORTED_MESSAGE,
    };
  }

  if (isExpoGo) {
    return {
      ok: false,
      reason: 'EXPO_GO_UNSUPPORTED',
      message: EXPO_GO_UNSUPPORTED_MESSAGE,
    };
  }

  if (!isPhysicalDevice) {
    return {
      ok: false,
      reason: 'PHYSICAL_DEVICE_REQUIRED',
      message: PHYSICAL_DEVICE_REQUIRED_MESSAGE,
    };
  }

  const Notifications = await loadNotificationsModule();
  if (!Notifications) {
    return {
      ok: false,
      reason: 'UNKNOWN_ERROR',
      message: 'No se pudo cargar expo-notifications.',
    };
  }

  try {
    const current = await Notifications.getPermissionsAsync();
    let status = current.status;

    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      status = requested.status;
    }

    if (status !== 'granted') {
      return {
        ok: false,
        reason: 'PERMISSION_DENIED',
        message: 'No se otorgo permiso para notificaciones push.',
      };
    }

    await ensureAndroidChannels(Notifications);

    const projectId = resolveProjectId();
    if (!projectId) {
      return {
        ok: false,
        reason: 'MISSING_PROJECT_ID',
        message:
          'No se encontro projectId de EAS para registrar Expo Push Token.',
      };
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const token =
      typeof tokenResponse.data === 'string' &&
      tokenResponse.data.trim().length > 0
        ? tokenResponse.data.trim()
        : null;

    if (!token) {
      return {
        ok: false,
        reason: 'UNKNOWN_ERROR',
        message: 'No se pudo obtener Expo Push Token.',
      };
    }

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
}

export async function registerPushTokenForUser(
  uid: string
): Promise<string | null> {
  if (!uid || uid.trim().length === 0) return null;
  if (!canUseRemotePushNotifications) return null;

  const status = await getNotificationPermissionStatus();
  if (status !== 'granted') return null;

  const Notifications = await loadNotificationsModule();
  if (!Notifications) return null;

  try {
    await ensureAndroidChannels(Notifications);

    const token = await getNativeDevicePushToken(Notifications);
    if (!token) {
      return null;
    }

    await setDoc(
      userDocRef(uid),
      {
        uid,
        notificationTokens: arrayUnion(token),
        pushTokenUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return token;
  } catch {
    return null;
  }
}

export async function unregisterPushToken(uid: string): Promise<void> {
  if (!uid || uid.trim().length === 0) return;
  if (!canUseRemotePushNotifications) return;

  const Notifications = await loadNotificationsModule();
  if (!Notifications) return;

  try {
    const token = await getNativeDevicePushToken(Notifications);
    const payload: Record<string, unknown> = {
      pushTokenUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (token) {
      payload.notificationTokens = arrayRemove(token);
    }

    await setDoc(userDocRef(uid), payload, { merge: true });
  } catch {
    // Silent fallback: user could be deleted or permissions unavailable.
  }
}

export async function clearDeliveredNotificationsAndBadge(): Promise<void> {
  if (!canUseRemotePushNotifications) return;

  const Notifications = await loadNotificationsModule();
  if (!Notifications) return;

  try {
    await Promise.all([
      Notifications.dismissAllNotificationsAsync(),
      Notifications.setBadgeCountAsync(0),
    ]);
  } catch {
    // Best effort: Android/iOS can reject this if permissions or APIs are unavailable.
  }
}

export async function syncNativeUnreadNotifications(
  unreadCount: number
): Promise<void> {
  if (!canUseRemotePushNotifications) return;

  const Notifications = await loadNotificationsModule();
  if (!Notifications) return;

  try {
    const normalizedCount = Math.max(0, unreadCount);
    await Notifications.setBadgeCountAsync(normalizedCount);

    if (normalizedCount === 0) {
      await Notifications.dismissAllNotificationsAsync();
    }
  } catch {
    // Native notification state is a convenience layer; Firestore remains canonical.
  }
}

export async function scheduleLocalNotification({
  title,
  body,
  channelId = 'default',
  data = {},
  delaySeconds = 0,
}: LocalNotificationOptions): Promise<string | null> {
  if (!canUseRemotePushNotifications) return null;

  const status = await getNotificationPermissionStatus();
  if (status !== 'granted') return null;

  const Notifications = await loadNotificationsModule();
  if (!Notifications) return null;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
      },
      trigger:
        delaySeconds > 0
          ? {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: delaySeconds,
            }
          : null,
    });

    if (Platform.OS === 'android' && channelId !== 'default') {
      await Notifications.setNotificationChannelAsync(channelId, {
        name: channelId,
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    return id;
  } catch {
    return null;
  }
}
