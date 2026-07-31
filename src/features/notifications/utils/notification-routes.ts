import type { AppNotification } from '@/src/features/notifications/types/notification.types';

const DEFAULT_ROUTE = '/(protected)/(tabs)/';

/**
 * Espejo cliente de functions/src/modules/notifications/notification-routes.ts.
 * Se usa como fallback cuando la notificacion no trae `data.url` (notificaciones
 * antiguas ya escritas en Firestore, sin migracion). Todo destino debe existir en
 * NOTIFICATION_HREF_ALLOWED_PREFIXES (src/utils/navigation/redirect.ts).
 */
export const resolveNotificationHref = (notification: AppNotification): string => {
  if (notification.type === 'billing') return '/(protected)/billing';

  if (notification.type === 'event') {
    return notification.eventId
      ? `/(protected)/events/${encodeURIComponent(notification.eventId)}`
      : DEFAULT_ROUTE;
  }

  // assignmentId de reunion viene como `${meetingId}:${assignmentKey}`
  const [meetingIdFromAssignment, assignmentKeyFromId] = (notification.assignmentId ?? '').split(':');
  const meetingId =
    notification.metadata?.meetingId ?? (assignmentKeyFromId ? meetingIdFromAssignment : null);

  if (meetingId) {
    const base = `/(protected)/meetings/${encodeURIComponent(meetingId)}`;
    return assignmentKeyFromId
      ? `${base}?assignmentKey=${encodeURIComponent(assignmentKeyFromId)}`
      : base;
  }

  if (notification.category === 'cleaning') return '/(protected)/(tabs)/cleaning';
  if (notification.category === 'hospitality') return '/(protected)/assignments/readers';
  if (notification.metadata?.role === 'Salida a discursar') {
    return '/(protected)/assignments/outgoing-talks';
  }

  return notification.assignmentId
    ? `/(protected)/assignments/${encodeURIComponent(notification.assignmentId)}`
    : DEFAULT_ROUTE;
};
