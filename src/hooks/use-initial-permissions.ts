/**
 * Hook de inicializacion de permisos.
 * En Expo Go no intenta registrar push remoto y nunca solicita permisos automaticos.
 */
import { useEffect, useRef, useState } from 'react';

import { getNotificationPermissionStatus } from '@/src/services/notifications/notifications-service';
import { PermissionStatus } from '@/src/types/permissions.types';
import { canUseRemotePushNotifications } from '@/src/utils/runtime';

interface UseInitialPermissionsResult {
  loading: boolean;
  requested: boolean;
  permissions: {
    notifications: PermissionStatus;
  };
}

export function useInitialPermissions(): UseInitialPermissionsResult {
  const initialized = useRef(false);
  const [loading, setLoading] = useState(canUseRemotePushNotifications);
  const [requested] = useState(false);
  const [permissions, setPermissions] = useState({
    notifications: (canUseRemotePushNotifications ? 'undetermined' : 'unavailable') as PermissionStatus,
  });

  useEffect(() => {
    if (initialized.current) return;

    initialized.current = true;

    const readPermissionStatus = async () => {
      if (!canUseRemotePushNotifications) return;
      try {
        const notificationsStatus = await getNotificationPermissionStatus();
        setPermissions({
          notifications: notificationsStatus,
        });
      } catch {
        setPermissions({ notifications: 'unavailable' });
      } finally {
        setLoading(false);
      }
    };

    void readPermissionStatus();
  }, []);

  return { loading, requested, permissions };
}
