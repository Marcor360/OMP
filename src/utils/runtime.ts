import Constants from 'expo-constants';
import { Platform } from 'react-native';

const appOwnership = (Constants.appOwnership ?? null) as string | null;

export const isExpoGo = appOwnership === 'expo';
export const isDevelopmentBuild =
  appOwnership === 'guest' || appOwnership === 'development';
export const canUseRemotePushNotifications =
  Platform.OS !== 'web' && !isExpoGo;

export const isPhysicalDevice = (() => {
  const maybeIsDevice = (Constants as { isDevice?: boolean }).isDevice;
  return typeof maybeIsDevice === 'boolean' ? maybeIsDevice : true;
})();
