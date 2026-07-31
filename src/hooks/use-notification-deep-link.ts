/**
 * Consume el deep link de un push tocado (app en frio o en caliente) y navega
 * al destino de `data.url`, siempre a traves de getSafeNotificationHref.
 *
 * No navega hasta que haya sesion y el perfil termine de cargar: un arranque en
 * frio que empuje una ruta protegida antes de montar (protected)/_layout rebota
 * al login y pierde el destino. Por eso el destino pendiente se guarda en una ref
 * y se consume cuando isAuthenticated && !loadingProfile.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';

import { useUser } from '@/src/context/user-context';
import { getSafeNotificationHref } from '@/src/utils/navigation/redirect';
import { canUseRemotePushNotifications } from '@/src/utils/runtime';

type NotificationsModule = typeof import('expo-notifications');
type NotificationResponse = import('expo-notifications').NotificationResponse;

const DEFAULT_ROUTE = '/(protected)/(tabs)/';

const loadNotificationsModule = async (): Promise<NotificationsModule | null> => {
  if (!canUseRemotePushNotifications) return null;

  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
};

export function useNotificationDeepLink(): void {
  const router = useRouter();
  const { congregationId, isSessionValid, loadingProfile } = useUser();

  const pendingHrefRef = useRef<string | null>(null);
  const processedIdsRef = useRef<Set<string>>(new Set());
  const authStateRef = useRef({ isSessionValid, loadingProfile, congregationId });
  authStateRef.current = { isSessionValid, loadingProfile, congregationId };

  const consumePendingHref = useCallback((): void => {
    const { isSessionValid: authed, loadingProfile: loading } = authStateRef.current;
    if (!pendingHrefRef.current || !authed || loading) return;

    const href = pendingHrefRef.current;
    pendingHrefRef.current = null;
    router.push(href as never);
  }, [router]);

  useEffect(() => {
    consumePendingHref();
  }, [isSessionValid, loadingProfile, consumePendingHref]);

  useEffect(() => {
    if (!canUseRemotePushNotifications) return;

    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

    const handleResponse = (response: NotificationResponse): void => {
      const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
      const notificationId =
        typeof data.notificationId === 'string' && data.notificationId.trim().length > 0
          ? data.notificationId
          : response.notification.request.identifier;

      if (processedIdsRef.current.has(notificationId)) return;
      processedIdsRef.current.add(notificationId);

      const dataCongregationId = typeof data.congregationId === 'string' ? data.congregationId : null;
      const activeCongregationId = authStateRef.current.congregationId;
      // Un usuario que cambio de congregacion no debe aterrizar en datos de otra.
      const mismatchesCongregation =
        dataCongregationId !== null &&
        activeCongregationId !== null &&
        dataCongregationId !== activeCongregationId;

      pendingHrefRef.current = mismatchesCongregation
        ? DEFAULT_ROUTE
        : getSafeNotificationHref(data.url);

      consumePendingHref();
    };

    void (async () => {
      const Notifications = await loadNotificationsModule();
      if (!Notifications || cancelled) return;

      subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);

      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      if (lastResponse && !cancelled) {
        handleResponse(lastResponse);
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- suscripcion unica; el estado reactivo se lee via authStateRef.
  }, []);
}
