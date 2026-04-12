import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

let notificationHandlerConfigured = false;

const configureNotificationHandler = (): void => {
  if (notificationHandlerConfigured) return;

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

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Notificaciones',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
};

const ensureNotificationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'web') {
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
  configureNotificationHandler();
  await ensureAndroidChannel();
};

export const getNativePushToken = async (): Promise<string | null> => {
  await configureMessaging();

  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) {
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
