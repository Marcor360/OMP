/**
 * Push notification service.
 * Handles permission checks, token registration in Firestore,
 * and local notifications for in-app reminders.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { arrayRemove, arrayUnion, serverTimestamp, setDoc } from 'firebase/firestore';

import { userDocRef } from '@/src/lib/firebase/refs';
import { PermissionStatus } from '@/src/types/permissions.types';

export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export async function getNotificationPermissionStatus(): Promise<PermissionStatus> {
  if (Platform.OS === 'web') return 'unavailable';

  try {
    const { status } = await Notifications.getPermissionsAsync();
    return mapExpoStatus(status);
  } catch {
    return 'unavailable';
  }
}

export async function requestNotificationPermission(): Promise<PermissionStatus> {
  if (Platform.OS === 'web') return 'unavailable';

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

export async function registerPushTokenForUser(uid: string): Promise<string | null> {
  if (!uid || uid.trim().length === 0) return null;
  if (Platform.OS === 'web') return null;

  const status = await getNotificationPermissionStatus();
  if (status !== 'granted') return null;

  try {
    if (Platform.OS === 'android') {
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
    }

    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token =
      typeof tokenData.data === 'string' && tokenData.data.trim().length > 0
        ? tokenData.data.trim()
        : null;

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
  } catch (err) {
    console.warn('[Notifications] No se pudo registrar push token:', err);
    return null;
  }
}

export async function unregisterPushToken(uid: string): Promise<void> {
  if (!uid || uid.trim().length === 0) return;
  if (Platform.OS === 'web') return;

  try {
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token =
      typeof tokenData.data === 'string' && tokenData.data.trim().length > 0
        ? tokenData.data.trim()
        : null;

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

export interface LocalNotificationOptions {
  title: string;
  body: string;
  channelId?: string;
  data?: Record<string, unknown>;
  delaySeconds?: number;
}

export async function scheduleLocalNotification({
  title,
  body,
  channelId = 'default',
  data = {},
  delaySeconds = 0,
}: LocalNotificationOptions): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const status = await getNotificationPermissionStatus();
  if (status !== 'granted') return null;

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

    // Preserve channel on Android even if default trigger is immediate.
    if (Platform.OS === 'android' && channelId !== 'default') {
      await Notifications.setNotificationChannelAsync(channelId, {
        name: channelId,
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    return id;
  } catch (err) {
    console.warn('[Notifications] Error al programar notificacion:', err);
    return null;
  }
}

function mapExpoStatus(
  raw: Notifications.PermissionStatus | 'granted' | 'denied' | 'undetermined'
): PermissionStatus {
  switch (raw) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    default:
      return 'undetermined';
  }
}
