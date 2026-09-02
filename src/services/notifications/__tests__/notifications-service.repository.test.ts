import { Platform } from 'react-native';

import {
  __resetNotificationsModuleForTests,
  __setNotificationsModuleForTests,
  scheduleLocalNotification,
} from '@/src/services/notifications/notifications-service';

jest.mock('@/src/utils/runtime', () => ({
  canUseRemotePushNotifications: true,
  isExpoGo: false,
  isPhysicalDevice: true,
}));

describe('scheduleLocalNotification', () => {
  const originalPlatformOs = Platform.OS;

  afterEach(() => {
    __resetNotificationsModuleForTests();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatformOs });
  });

  it('creates Android channels before scheduling and passes the channel in content', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const calls: string[] = [];
    __setNotificationsModuleForTests({
      AndroidImportance: { DEFAULT: 3, HIGH: 4 },
      SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
      getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
      setNotificationChannelAsync: jest.fn(async () => { calls.push('channel'); }),
      scheduleNotificationAsync: jest.fn(async (input) => {
        calls.push('schedule');
        expect(input.content.channelId).toBe('cleaning');
        return 'notification-id';
      }),
    } as unknown as typeof import('expo-notifications'));

    await expect(scheduleLocalNotification({ title: 'T', body: 'B', channelId: 'cleaning' }))
      .resolves.toBe('notification-id');
    expect(calls).toEqual(['channel', 'channel', 'schedule']);
  });
});
