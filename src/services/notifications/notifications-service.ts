/**
 * Servicio de notificaciones push.
 * Gestiona permisos, registro de token Expo en Firestore y envío de notificaciones locales.
 * Funciona con expo-notifications (ya instalado).
 */
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { updateDoc } from 'firebase/firestore';

import { userDocRef } from '@/src/lib/firebase/refs';
import { PermissionStatus } from '@/src/types/permissions.types';

// ─── Configuración del handler de notificaciones ──────────────────────────────

/** Configura cómo se comportan las notificaciones mientras la app está en primer plano. */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

// ─── Verificar estado del permiso ─────────────────────────────────────────────

export async function getNotificationPermissionStatus(): Promise<PermissionStatus> {
  if (Platform.OS === 'web') return 'unavailable';

  try {
    const { status } = await Notifications.getPermissionsAsync();
    return mapExpoStatus(status);
  } catch {
    return 'unavailable';
  }
}

// ─── Solicitar permiso ────────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<PermissionStatus> {
  if (Platform.OS === 'web') return 'unavailable';

  try {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowAnnouncements: true,
      },
    });
    return mapExpoStatus(status);
  } catch {
    return 'denied';
  }
}

// ─── Obtener token push y guardarlo en Firestore ──────────────────────────────

/**
 * Obtiene el Expo Push Token y lo almacena en el documento del usuario en Firestore.
 * Solo funciona en dispositivos físicos (no en simulador sin configuración adicional).
 */
export async function registerPushTokenForUser(uid: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const status = await getNotificationPermissionStatus();
  if (status !== 'granted') return null;

  try {
    // projectId es obligatorio para Expo Go y builds de producción
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const tokenData = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();

    const token = tokenData.data;

    // Canales Android (obligatorio para Android 8+)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'General',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('cleaning', {
        name: 'Limpieza',
        description: 'Notificaciones del módulo de grupos de limpieza',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 200, 100, 200],
        lightColor: '#16A34A',
        sound: 'default',
      });
    }

    // Guardar token en Firestore
    await updateDoc(userDocRef(uid), {
      expoPushToken: token,
      pushTokenUpdatedAt: new Date().toISOString(),
    });

    return token;
  } catch (err) {
    console.warn('[Notifications] No se pudo registrar push token:', err);
    return null;
  }
}

// ─── Eliminar token (al cerrar sesión) ───────────────────────────────────────

/** Elimina el push token de Firestore cuando el usuario cierra sesión. */
export async function unregisterPushToken(uid: string): Promise<void> {
  try {
    await updateDoc(userDocRef(uid), {
      expoPushToken: null,
      pushTokenUpdatedAt: null,
    });
  } catch {
    // Silencioso: el usuario puede haberse eliminado
  }
}

// ─── Notificación local (para pruebas y alertas in-app) ──────────────────────

export interface LocalNotificationOptions {
  title: string;
  body: string;
  channelId?: string;
  data?: Record<string, unknown>;
  delaySeconds?: number;
}

/** Programa una notificación local inmediata o con delay. */
export async function scheduleLocalNotification({
  title,
  body,
  channelId = 'default',
  data = {},
  delaySeconds = 0,
}: LocalNotificationOptions): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const status = await getNotificationPermissionStatus();
  if (status !== 'granted') return null;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
      },
      trigger:
        delaySeconds > 0
          ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: delaySeconds }
          : null,
    });
    return id;
  } catch (err) {
    console.warn('[Notifications] Error al programar notificación:', err);
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapExpoStatus(
  raw: Notifications.PermissionStatus | 'granted' | 'denied' | 'undetermined'
): PermissionStatus {
  switch (raw) {
    case 'granted': return 'granted';
    case 'denied': return 'denied';
    default: return 'undetermined';
  }
}
