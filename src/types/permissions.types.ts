/**
 * Tipos centralizados para el sistema de permisos del dispositivo.
 */

export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export interface PermissionState {
  notifications: PermissionStatus;
  camera: PermissionStatus;
}

export interface AppPermissions {
  /** Estado actual de cada permiso */
  state: PermissionState;
  /** true mientras se está verificando o solicitando permisos */
  loading: boolean;
  /** Solicita el permiso de notificaciones push */
  requestNotifications: () => Promise<PermissionStatus>;
  /** Solicita el permiso de cámara */
  requestCamera: () => Promise<PermissionStatus>;
  /** Re-verifica todos los permisos del sistema */
  refresh: () => Promise<void>;
  /** Abre la configuración del SO para este permiso */
  openSettings: () => Promise<void>;
}
