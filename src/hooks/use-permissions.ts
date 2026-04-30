/**
 * Hook centralizado para gestion de permisos del dispositivo.
 * No dispara registro remoto en Expo Go y no entra en bucles de re-render.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Linking } from 'react-native';

import { useUser } from '@/src/context/user-context';
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
} from '@/src/services/notifications/notifications-service';
import { registerExpoPushTokenForUser } from '@/src/services/notifications/push-notifications.service';
import { PermissionState, PermissionStatus } from '@/src/types/permissions.types';
import { canUseRemotePushNotifications } from '@/src/utils/runtime';

interface UsePermissionsResult {
  state: PermissionState;
  loading: boolean;
  requestNotifications: () => Promise<PermissionStatus>;
  openSettings: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function usePermissions(): UsePermissionsResult {
  const { uid, congregationId } = useUser();
  const [state, setState] = useState<PermissionState>({
    notifications: 'undetermined',
  });
  const [loading, setLoading] = useState(true);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const fetchAll = useCallback(async () => {
    if (!canUseRemotePushNotifications) {
      setState({ notifications: 'unavailable' });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const notifications = await getNotificationPermissionStatus();
      setState({ notifications });
    } catch {
      setState({ notifications: 'unavailable' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === 'active'
      ) {
        void fetchAll();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [fetchAll]);

  const requestNotifications = useCallback(async (): Promise<PermissionStatus> => {
    if (!canUseRemotePushNotifications) {
      setState((prev) => ({ ...prev, notifications: 'unavailable' }));
      return 'unavailable';
    }

    const result = await requestNotificationPermission();
    setState((prev) => ({ ...prev, notifications: result }));

    if (result === 'granted' && uid && congregationId) {
      void registerExpoPushTokenForUser({
        userId: uid,
        congregationId,
      });
    }

    return result;
  }, [congregationId, uid]);

  const openSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      // Silent fallback
    }
  }, []);

  return {
    state,
    loading,
    requestNotifications,
    openSettings,
    refresh: fetchAll,
  };
}
