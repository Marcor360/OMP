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
  const [loading, setLoading] = useState(true);
  const [requested] = useState(false);
  const [permissions, setPermissions] = useState({
    notifications: 'undetermined' as PermissionStatus,
  });

  useEffect(() => {
    if (initialized.current) {
      setLoading(false);
      return;
    }

    initialized.current = true;

    if (!canUseRemotePushNotifications) {
      setPermissions({ notifications: 'unavailable' });
      setLoading(false);
      return;
    }

    const readPermissionStatus = async () => {
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
