import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { canUseRemotePushNotifications } from '@/src/utils/runtime';

type NotificationsModule = typeof import('expo-notifications');

let notificationHandlerConfigured = false;
let notificationsModulePromise: Promise<NotificationsModule | null> | null =
  null;

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

const configureNotificationHandler = async (): Promise<void> => {
  if (notificationHandlerConfigured) return;

  const Notifications = await loadNotificationsModule();
  if (!Notifications || notificationHandlerConfigured) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  notificationHandlerConfigured = true;
};

const ensureAndroidChannel = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;

  const Notifications = await loadNotificationsModule();
  if (!Notifications) return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Notificaciones',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
};

const ensureNotificationPermission = async (): Promise<boolean> => {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) {
    return false;
  }

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;

  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  return status === 'granted';
};

export const configureMessaging = async (): Promise<void> => {
  if (!canUseRemotePushNotifications) {
    return;
  }

  await configureNotificationHandler();
  await ensureAndroidChannel();
};

export const getNativePushToken = async (): Promise<string | null> => {
  if (!canUseRemotePushNotifications) {
    return null;
  }

  if (Platform.OS === 'android' && Constants.appOwnership === 'expo') {
    return null;
  }

  await configureMessaging();

  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) {
    return null;
  }

  const Notifications = await loadNotificationsModule();
  if (!Notifications) {
    return null;
  }

  try {
    const token = await Notifications.getDevicePushTokenAsync();
    if (typeof token.data === 'string' && token.data.trim().length > 0) {
      return token.data.trim();
    }

    return null;
  } catch {
    return null;
  }
};
