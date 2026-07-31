import { NotificationCategory, NotificationMetadata } from './notification.types.js';

const DEFAULT_ROUTE = '/(protected)/(tabs)/';

export type NotificationRouteInput = {
  type: 'assignment' | 'event';
  category: NotificationCategory | null;
  assignmentId?: string | null;
  eventId?: string | null;
  metadata?: NotificationMetadata;
};

/**
 * Punto unico de verdad del destino de cada notificacion.
 * Espejo cliente: src/features/notifications/utils/notification-routes.ts
 * Todo destino debe existir en NOTIFICATION_HREF_ALLOWED_PREFIXES
 * (src/utils/navigation/redirect.ts) o el cliente lo degradara al home.
 */
export const buildNotificationUrl = (input: NotificationRouteInput): string => {
  if (input.type === 'event') {
    return input.eventId
      ? `/(protected)/events/${encodeURIComponent(input.eventId)}`
      : DEFAULT_ROUTE;
  }

  // assignmentId de reunion viene como `${meetingId}:${assignmentKey}`
  const [meetingIdFromAssignment, assignmentKeyFromId] = (input.assignmentId ?? '').split(':');
  const meetingId = input.metadata?.meetingId ?? (assignmentKeyFromId ? meetingIdFromAssignment : null);

  if (meetingId) {
    const base = `/(protected)/meetings/${encodeURIComponent(meetingId)}`;
    return assignmentKeyFromId
      ? `${base}?assignmentKey=${encodeURIComponent(assignmentKeyFromId)}`
      : base;
  }

  if (input.category === 'cleaning') return '/(protected)/(tabs)/cleaning';
  if (input.category === 'hospitality') return '/(protected)/assignments/readers';
  if (input.metadata?.role === 'Salida a discursar') {
    return '/(protected)/assignments/outgoing-talks';
  }

  return input.assignmentId
    ? `/(protected)/assignments/${encodeURIComponent(input.assignmentId)}`
    : DEFAULT_ROUTE;
};
