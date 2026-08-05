import { AppNotification } from '@/src/features/notifications/types/notification.types';
import { firestoreNotificationRepository } from '@/src/services/repositories/firestore/firestore-notification-repository';
import type {
  NotificationRecord,
  NotificationRepository,
  Unsubscribe,
} from '@/src/services/repositories/ports/notification-repository.port';

let notificationRepository: NotificationRepository = firestoreNotificationRepository;

export const __setNotificationRepositoryForTests = (
  repo: NotificationRepository
): void => {
  notificationRepository = repo;
};

export const __resetNotificationRepositoryForTests = (): void => {
  notificationRepository = firestoreNotificationRepository;
};

const startOfTodayMillis = (): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
};

const toDateMillis = (value: string | null | undefined): number | null => {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoDateOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnly) {
    const parsed = new Date(`${trimmed}T00:00:00.000`).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }

  const parsed = new Date(trimmed).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

const isFirestoreTimestamp = (value: unknown): value is AppNotification['createdAt'] => {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.seconds === 'number' &&
    typeof candidate.nanoseconds === 'number' &&
    typeof candidate.toDate === 'function'
  );
};

export const resolveNotificationDateMillis = (
  notification: AppNotification
): number | null => {
  const meetingDate = notification.metadata?.meetingDate;

  if (meetingDate && isFirestoreTimestamp(meetingDate)) {
    return meetingDate.seconds * 1000;
  }

  return (
    toDateMillis(notification.metadata?.meetingDateLabel) ??
    toDateMillis(notification.metadata?.date)
  );
};

const isNotificationCurrent = (notification: AppNotification): boolean => {
  const notificationDate = resolveNotificationDateMillis(notification);

  if (notificationDate === null) {
    return true;
  }

  return notificationDate >= startOfTodayMillis();
};

const normalizeNotification = (
  id: string,
  raw: Record<string, unknown>
): AppNotification | null => {
  if (typeof raw.userId !== 'string' || raw.userId.trim().length === 0) {
    return null;
  }

  if (typeof raw.title !== 'string' || typeof raw.body !== 'string') {
    return null;
  }

  const type = raw.type === 'event' || raw.type === 'billing' ? raw.type : 'assignment';

  if (
    type === 'assignment' &&
    (typeof raw.assignmentId !== 'string' || raw.assignmentId.trim().length === 0)
  ) {
    return null;
  }

  if (
    type === 'event' &&
    (typeof raw.eventId !== 'string' || raw.eventId.trim().length === 0)
  ) {
    return null;
  }

  const createdAt = raw.createdAt;

  if (!isFirestoreTimestamp(createdAt)) {
    return null;
  }

  // Soporte de lectura retrocompatible: acepta tanto `isRead` (esquema canónico)
  // como el campo legacy `read` para documentos creados antes de la migración.
  const isRead =
    typeof raw.isRead === 'boolean'
      ? raw.isRead
      : raw.read === true;

  return {
    id,
    userId: raw.userId,
    congregationId: typeof raw.congregationId === 'string' ? raw.congregationId : null,
    type,
    category:
      raw.category === 'platform' || raw.category === 'cleaning' || raw.category === 'hospitality'
        ? raw.category
        : null,
    title: raw.title,
    body: raw.body,
    assignmentId: typeof raw.assignmentId === 'string' ? raw.assignmentId : undefined,
    eventId: typeof raw.eventId === 'string' ? raw.eventId : undefined,
    eventType: typeof raw.eventType === 'string' ? raw.eventType : undefined,
    isRead,
    read: isRead,
    createdAt,
    sentBy: typeof raw.sentBy === 'string' ? raw.sentBy : null,
    metadata:
      raw.metadata && typeof raw.metadata === 'object'
        ? {
            meetingDate: isFirestoreTimestamp(
              (raw.metadata as Record<string, unknown>).meetingDate
            )
              ? (raw.metadata as Record<string, unknown>).meetingDate as AppNotification['createdAt']
              : null,
            meetingDateLabel:
              typeof (raw.metadata as Record<string, unknown>).meetingDateLabel === 'string'
                ? ((raw.metadata as Record<string, unknown>).meetingDateLabel as string)
                : null,
            date:
              typeof (raw.metadata as Record<string, unknown>).date === 'string'
                ? ((raw.metadata as Record<string, unknown>).date as string)
                : null,
            meetingId:
              typeof (raw.metadata as Record<string, unknown>).meetingId === 'string'
                ? ((raw.metadata as Record<string, unknown>).meetingId as string)
                : null,
            meetingType:
              (raw.metadata as Record<string, unknown>).meetingType === 'midweek' ||
              (raw.metadata as Record<string, unknown>).meetingType === 'weekend'
                ? ((raw.metadata as Record<string, unknown>).meetingType as 'midweek' | 'weekend')
                : null,
            role:
              typeof (raw.metadata as Record<string, unknown>).role === 'string'
                ? ((raw.metadata as Record<string, unknown>).role as string)
                : null,
            billingEvent:
              typeof (raw.metadata as Record<string, unknown>).billingEvent === 'string'
                ? ((raw.metadata as Record<string, unknown>).billingEvent as string)
                : null,
            daysUntilPayment:
              typeof (raw.metadata as Record<string, unknown>).daysUntilPayment === 'number'
                ? ((raw.metadata as Record<string, unknown>).daysUntilPayment as number)
                : null,
            nextPaymentDate:
              typeof (raw.metadata as Record<string, unknown>).nextPaymentDate === 'string'
                ? ((raw.metadata as Record<string, unknown>).nextPaymentDate as string)
                : null,
            invoiceId:
              typeof (raw.metadata as Record<string, unknown>).invoiceId === 'string'
                ? ((raw.metadata as Record<string, unknown>).invoiceId as string)
                : null,
            invoiceUrl:
              typeof (raw.metadata as Record<string, unknown>).invoiceUrl === 'string'
                ? ((raw.metadata as Record<string, unknown>).invoiceUrl as string)
                : null,
          }
        : undefined,
    data:
      raw.data && typeof raw.data === 'object'
        ? {
            url:
              typeof (raw.data as Record<string, unknown>).url === 'string'
                ? ((raw.data as Record<string, unknown>).url as string)
                : null,
          }
        : undefined,
  };
};

const normalizeNotificationRecord = (
  record: NotificationRecord
): AppNotification | null => normalizeNotification(record.id, record.data);

export const getUserNotifications = async (
  uid: string,
  congregationId?: string | null
): Promise<AppNotification[]> => {
  if (!uid || uid.trim().length === 0) {
    return [];
  }

  if (!congregationId || congregationId.trim().length === 0) {
    return [];
  }

  const records = await notificationRepository.list(congregationId, uid);

  return records
    .map(normalizeNotificationRecord)
    .filter((item): item is AppNotification => item !== null)
    .filter(isNotificationCurrent);
};

export const subscribeToUserNotifications = (
  uid: string,
  congregationId: string | null | undefined,
  callback: (notifications: AppNotification[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe => {
  if (!uid || uid.trim().length === 0) {
    callback([]);
    return () => {};
  }

  if (!congregationId || congregationId.trim().length === 0) {
    callback([]);
    return () => {};
  }

  return notificationRepository.subscribeUserNotifications(
    congregationId,
    uid,
    (records) => {
      const list = records
        .map(normalizeNotificationRecord)
        .filter((item): item is AppNotification => item !== null)
        .filter(isNotificationCurrent);

      callback(list);
    },
    onError
  );
};

export const subscribeToUnreadNotificationsCount = (
  uid: string,
  congregationId: string | null | undefined,
  callback: (count: number) => void,
  onError?: (error: unknown) => void
): Unsubscribe => {
  if (!uid || uid.trim().length === 0) {
    callback(0);
    return () => {};
  }

  if (!congregationId || congregationId.trim().length === 0) {
    callback(0);
    return () => {};
  }

  return notificationRepository.subscribeUnreadCount(
    congregationId,
    uid,
    (records) => {
      const count = records
        .map(normalizeNotificationRecord)
        .filter((item): item is AppNotification => item !== null)
        .filter(isNotificationCurrent).length;

      callback(count);
    },
    onError
  );
};

export const markNotificationAsRead = async (
  notificationId: string,
  congregationId?: string | null
): Promise<void> => {
  if (!notificationId || notificationId.trim().length === 0) {
    return;
  }

  if (!congregationId || congregationId.trim().length === 0) {
    return;
  }

  await notificationRepository.markAsRead(congregationId, notificationId);
};

export const markAllNotificationsAsRead = async (
  uid: string,
  congregationId?: string | null
): Promise<number> => {
  if (!uid || uid.trim().length === 0) {
    return 0;
  }

  if (!congregationId || congregationId.trim().length === 0) {
    return 0;
  }

  return notificationRepository.markAllAsRead(congregationId, uid);
};
