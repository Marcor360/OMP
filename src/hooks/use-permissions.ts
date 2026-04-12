/**
 * Hook centralizado para gestión de permisos del dispositivo.
 * Unifica notificaciones + cámara + galería en una sola interfaz reactiva.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
} from '@/src/services/notifications/notifications-service';
import {
  getCameraPermissionStatus,
  getMediaLibraryPermissionStatus,
  openAppSettings,
  requestCameraPermission,
  requestMediaLibraryPermission,
} from '@/src/services/notifications/camera-service';
import { PermissionState, PermissionStatus } from '@/src/types/permissions.types';

interface UsePermissionsResult {
  state: PermissionState & { mediaLibrary: PermissionStatus };
  loading: boolean;
  /** Solicita permiso de notificaciones push */
  requestNotifications: () => Promise<PermissionStatus>;
  /** Solicita permiso de cámara */
  requestCamera: () => Promise<PermissionStatus>;
  /** Solicita permiso de galería/fotos */
  requestMediaLibrary: () => Promise<PermissionStatus>;
  /** Abre la configuración del sistema para conceder permisos manualmente */
  openSettings: () => Promise<void>;
  /** Re-verifica todos los permisos (útil al volver de Settings) */
  refresh: () => Promise<void>;
}

/**
 * Hook que gestiona todos los permisos del dispositivo necesarios en la app.
 * Re-verifica automáticamente cuando la app vuelve al frente (útil después de Settings).
 */
export function usePermissions(): UsePermissionsResult {
  const [state, setState] = useState<PermissionState & { mediaLibrary: PermissionStatus }>({
    notifications: 'undetermined',
    camera: 'undetermined',
    mediaLibrary: 'undetermined',
  });
  const [loading, setLoading] = useState(true);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [notifications, camera, mediaLibrary] = await Promise.all([
        getNotificationPermissionStatus(),
        getCameraPermissionStatus(),
        getMediaLibraryPermissionStatus(),
      ]);
      setState({ notifications, camera, mediaLibrary });
    } catch {
      // Si falla alguna verificación, dejamos el estado previo
    } finally {
      setLoading(false);
    }
  }, []);

  // Verificar permisos al montar
  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Re-verificar cuando la app vuelve al frente (el usuario puede haber cambiado permisos en Settings)
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
    const result = await requestNotificationPermission();
    setState((prev) => ({ ...prev, notifications: result }));
    return result;
  }, []);

  const requestCamera = useCallback(async (): Promise<PermissionStatus> => {
    const result = await requestCameraPermission();
    setState((prev) => ({ ...prev, camera: result }));
    return result;
  }, []);

  const requestMediaLibrary = useCallback(async (): Promise<PermissionStatus> => {
    const result = await requestMediaLibraryPermission();
    setState((prev) => ({ ...prev, mediaLibrary: result }));
    return result;
  }, []);

  return {
    state,
    loading,
    requestNotifications,
    requestCamera,
    requestMediaLibrary,
    openSettings: openAppSettings,
    refresh: fetchAll,
  };
}
