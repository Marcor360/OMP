import type {
  PushTokenRepository,
  RemovePushTokenPayload,
  SavePushTokenPayload,
} from '@/src/services/repositories/ports/push-token-repository.port';
import {
  __resetNotificationsModuleForTests,
  __resetPushTokenRepositoryForTests,
  __setNotificationsModuleForTests,
  __setPushTokenRepositoryForTests,
  registerPushTokenForUser,
} from '@/src/services/notifications/notifications-service';

jest.mock('@/src/services/repositories/firestore/firestore-push-token-repository', () => ({
  firestorePushTokenRepository: {
    savePushToken: jest.fn(),
    removePushToken: jest.fn(),
  },
}));

jest.mock('@/src/utils/runtime', () => ({
  canUseRemotePushNotifications: true,
  isExpoGo: false,
  isPhysicalDevice: true,
}));

class FakePushTokenRepository implements PushTokenRepository {
  readonly saved: { uid: string; payload: SavePushTokenPayload }[] = [];
  readonly removed: { uid: string; payload: RemovePushTokenPayload }[] = [];

  savePushToken(uid: string, payload: SavePushTokenPayload): Promise<void> {
    this.saved.push({ uid, payload });
    return Promise.resolve();
  }

  removePushToken(uid: string, payload: RemovePushTokenPayload): Promise<void> {
    this.removed.push({ uid, payload });
    return Promise.resolve();
  }
}

describe('notifications-service push token repository seam', () => {
  afterEach(() => {
    __resetPushTokenRepositoryForTests();
    __resetNotificationsModuleForTests();
    jest.clearAllMocks();
  });

  it('registerPushTokenForUser sends the expected payload to savePushToken', async () => {
    const repo = new FakePushTokenRepository();
    __setPushTokenRepositoryForTests(repo);
    __setNotificationsModuleForTests({
      AndroidImportance: {
        DEFAULT: 3,
        HIGH: 4,
      },
      getDevicePushTokenAsync: jest.fn(() =>
        Promise.resolve({ data: 'native-token-1' })
      ),
      getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
      requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
      setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
      setNotificationHandler: jest.fn(),
    } as unknown as typeof import('expo-notifications'));

    const token = await registerPushTokenForUser('user-1');

    expect(token).toBe('native-token-1');
    expect(repo.saved).toEqual([
      {
        uid: 'user-1',
        payload: {
          kind: 'userProfile',
          token: 'native-token-1',
          includePushTokenUpdatedAt: true,
        },
      },
    ]);
    expect(repo.removed).toEqual([]);
  });
});
