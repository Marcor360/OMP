import React from 'react';
import { act, create } from 'react-test-renderer';
import { Alert } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStartupPermissionPrompt } from '@/src/hooks/use-startup-permission-prompt';
import {
  getPushNotificationPermissionStatus,
  registerExpoPushTokenForUser,
  requestPushNotificationPermission,
} from '@/src/services/notifications/push-notifications.service';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('@/src/utils/runtime', () => ({
  canUseRemotePushNotifications: true,
}));

jest.mock('@/src/i18n/index', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock('@/src/services/notifications/push-notifications.service', () => ({
  getPushNotificationPermissionStatus: jest.fn(),
  requestPushNotificationPermission: jest.fn(),
  registerExpoPushTokenForUser: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockedGetStatus = getPushNotificationPermissionStatus as jest.Mock;
const mockedRequestPermission = requestPushNotificationPermission as jest.Mock;
const mockedRegisterToken = registerExpoPushTokenForUser as jest.Mock;

function Harness(props: {
  uid: string | null;
  congregationId: string | null;
  isAuthenticated: boolean;
}) {
  useStartupPermissionPrompt(props);
  return null;
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

const unmountRenderer = (renderer: ReturnType<typeof create>) =>
  act(() => {
    renderer.unmount();
  });

const mount = async () => {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      React.createElement(Harness, {
        uid: 'user-1',
        congregationId: 'cong-1',
        isAuthenticated: true,
      })
    );
    await flush();
    await flush();
  });
  return renderer!;
};

type AlertButton = { text?: string; style?: string; onPress?: () => void };

let alertSpy: jest.SpyInstance;

const getButtons = (): AlertButton[] => {
  const call = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
  return (call?.[2] as AlertButton[]) ?? [];
};

describe('useStartupPermissionPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('shows the rationale alert when status is undetermined and there is no stored flag', async () => {
    mockedGetStatus.mockResolvedValue('undetermined');

    const renderer = await mount();

    expect(alertSpy).toHaveBeenCalledTimes(1);
    unmountRenderer(renderer);
  });

  it('persists exhausted after "Ahora no" is tapped twice across two mounts, and stops prompting on the third', async () => {
    mockedGetStatus.mockResolvedValue('undetermined');

    // Mount 1: no flag -> alert shown -> tap "Ahora no" -> persists 'declined_once'
    mockAsyncStorage.getItem.mockResolvedValue(null);
    const renderer1 = await mount();
    expect(alertSpy).toHaveBeenCalledTimes(1);

    const notNow1 = getButtons().find((b) => b.style === 'cancel');
    await act(async () => {
      notNow1?.onPress?.();
      await flush();
    });
    expect(mockAsyncStorage.setItem).toHaveBeenLastCalledWith(
      expect.stringContaining('user-1'),
      'declined_once'
    );
    unmountRenderer(renderer1);
    alertSpy.mockClear();
    mockAsyncStorage.setItem.mockClear();

    // Mount 2: flag = 'declined_once' -> alert shown one last time -> tap "Ahora no" -> persists 'exhausted'
    mockAsyncStorage.getItem.mockResolvedValue('declined_once');
    const renderer2 = await mount();
    expect(alertSpy).toHaveBeenCalledTimes(1);

    const notNow2 = getButtons().find((b) => b.style === 'cancel');
    await act(async () => {
      notNow2?.onPress?.();
      await flush();
    });
    expect(mockAsyncStorage.setItem).toHaveBeenLastCalledWith(
      expect.stringContaining('user-1'),
      'exhausted'
    );
    unmountRenderer(renderer2);
    alertSpy.mockClear();

    // Mount 3: flag = 'exhausted' -> no alert
    mockAsyncStorage.getItem.mockResolvedValue('exhausted');
    const renderer3 = await mount();
    expect(alertSpy).not.toHaveBeenCalled();
    unmountRenderer(renderer3);
  });

  it('persists accepted and registers the push token when "Permitir" is tapped and permission is granted', async () => {
    mockedGetStatus.mockResolvedValue('undetermined');
    mockedRequestPermission.mockResolvedValue('granted');

    const renderer = await mount();
    const allow = getButtons().find((b) => b.style !== 'cancel');

    await act(async () => {
      allow?.onPress?.();
      await flush();
      await flush();
    });

    expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
      expect.stringContaining('user-1'),
      'accepted'
    );
    expect(mockedRegisterToken).toHaveBeenCalledWith({
      userId: 'user-1',
      congregationId: 'cong-1',
    });
    unmountRenderer(renderer);
  });

  it('does not show an alert when status is denied and the flag is already exhausted', async () => {
    mockedGetStatus.mockResolvedValue('denied');
    mockAsyncStorage.getItem.mockResolvedValue('exhausted');

    const renderer = await mount();

    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockAsyncStorage.setItem).not.toHaveBeenCalled();
    unmountRenderer(renderer);
  });

  it('does nothing when canUseRemotePushNotifications is false', async () => {
    const mutableRuntime = jest.requireMock('@/src/utils/runtime') as {
      canUseRemotePushNotifications: boolean;
    };
    mutableRuntime.canUseRemotePushNotifications = false;

    try {
      const renderer = await mount();

      expect(mockedGetStatus).not.toHaveBeenCalled();
      expect(alertSpy).not.toHaveBeenCalled();

      unmountRenderer(renderer);
    } finally {
      mutableRuntime.canUseRemotePushNotifications = true;
    }
  });
});
