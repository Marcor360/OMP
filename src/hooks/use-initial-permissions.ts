/**
 * Hook que solicita permisos del dispositivo automáticamente al iniciar la app.
 * Solo muestra el modal de solicitud si el usuario nunca ha respondido antes (undetermined).
 */
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
} from '@/src/services/notifications/notifications-service';
import {
  getCameraPermissionStatus,
  getMediaLibraryPermissionStatus,
  requestCameraPermission,
  requestMediaLibraryPermission,
} from '@/src/services/notifications/camera-service';
import { PermissionStatus } from '@/src/types/permissions.types';

interface UseInitialPermissionsResult {
  loading: boolean;
  requested: boolean;
  permissions: {
    notifications: PermissionStatus;
    camera: PermissionStatus;
    mediaLibrary: PermissionStatus;
  };
}

/**
 * Solicita permisos automáticamente la primera vez que el usuario inicia la app.
 * Solo pide permisos en estado 'undetermined' (nunca respondidos).
 */
export function useInitialPermissions(): UseInitialPermissionsResult {
  const initialized = useRef(false);
  const [loading, setLoading] = useState(true);
  const [requested, setRequested] = useState(false);
  const [permissions, setPermissions] = useState({
    notifications: 'undetermined' as PermissionStatus,
    camera: 'undetermined' as PermissionStatus,
    mediaLibrary: 'undetermined' as PermissionStatus,
  });

  useEffect(() => {
    if (initialized.current || Platform.OS === 'web') {
      setLoading(false);
      return;
    }

    initialized.current = true;

    async function requestInitialPermissions() {
      try {
        // Verificar estado actual de todos los permisos
        const [notificationsStatus, cameraStatus, mediaLibraryStatus] = await Promise.all([
          getNotificationPermissionStatus(),
          getCameraPermissionStatus(),
          getMediaLibraryPermissionStatus(),
        ]);

        setPermissions({
          notifications: notificationsStatus,
          camera: cameraStatus,
          mediaLibrary: mediaLibraryStatus,
        });

        // Solo solicitar si el usuario nunca ha respondido (undetermined)
        const needsNotification = notificationsStatus === 'undetermined';
        const needsCamera = cameraStatus === 'undetermined';
        const needsMediaLibrary = mediaLibraryStatus === 'undetermined';

        if (needsNotification || needsCamera || needsMediaLibrary) {
          // Pequeño delay para que la UI ya esté montada
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Solicitar permisos pendientes (en paralelo si son múltiples)
          const results = await Promise.all([
            needsNotification ? requestNotificationPermission() : Promise.resolve(notificationsStatus),
            needsCamera ? requestCameraPermission() : Promise.resolve(cameraStatus),
            needsMediaLibrary ? requestMediaLibraryPermission() : Promise.resolve(mediaLibraryStatus),
          ]);

          setPermissions({
            notifications: results[0],
            camera: results[1],
            mediaLibrary: results[2],
          });

          setRequested(true);
        }
      } catch (err) {
        console.warn('[InitialPermissions] Error al solicitar permisos:', err);
      } finally {
        setLoading(false);
      }
    }

    void requestInitialPermissions();
  }, []);

  return { loading, requested, permissions };
}
