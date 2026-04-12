/**
 * Hook que inicializa el sistema de notificaciones push cuando el usuario
 * está autenticado. Registra el token en Firestore de forma silenciosa.
 */
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';

import {
  configureNotificationHandler,
  registerPushTokenForUser,
} from '@/src/services/notifications/notifications-service';

interface UseNotificationSetupOptions {
  uid: string | null;
  isAuthenticated: boolean;
}

/**
 * Configura el handler de notificaciones y registra el push token del usuario.
 * Devuelve una función para remover los listeners al desmontar.
 */
export function useNotificationSetup({
  uid,
  isAuthenticated,
}: UseNotificationSetupOptions): void {
  const initialized = useRef(false);

  useEffect(() => {
    // Configurar cómo se muestran las notificaciones (solo una vez)
    configureNotificationHandler();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !uid || initialized.current) return;

    initialized.current = true;

    // Registrar token de forma silenciosa — no bloquea la UI si falla
    void registerPushTokenForUser(uid);
  }, [isAuthenticated, uid]);

  useEffect(() => {
    if (!isAuthenticated) {
      initialized.current = false;
    }
  }, [isAuthenticated]);
}
