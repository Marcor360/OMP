import {
  Unsubscribe,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import {
  notificationDocRef,
  notificationsCollectionRef,
} from '@/src/lib/firebase/refs';
import { AppNotification } from '@/src/features/notifications/types/notification.types';

const PAGE_LIMIT = 100;

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

  if (typeof raw.assignmentId !== 'string' || raw.assignmentId.trim().length === 0) {
    return null;
  }

  const createdAt = raw.createdAt;

  if (!createdAt || typeof createdAt !== 'object' || !("seconds" in (createdAt as object))) {
    return null;
  }

  return {
    id,
    userId: raw.userId,
    congregationId: typeof raw.congregationId === 'string' ? raw.congregationId : null,
    type: raw.type === 'assignment' ? 'assignment' : 'assignment',
    category:
      raw.category === 'platform' || raw.category === 'cleaning' || raw.category === 'hospitality'
        ? raw.category
        : null,
    title: raw.title,
    body: raw.body,
    assignmentId: raw.assignmentId,
    read: raw.read === true,
    createdAt: createdAt as AppNotification['createdAt'],
    sentBy: typeof raw.sentBy === 'string' ? raw.sentBy : null,
    metadata:
      raw.metadata && typeof raw.metadata === 'object'
        ? {
            date:
              typeof (raw.metadata as Record<string, unknown>).date === 'string'
                ? ((raw.metadata as Record<string, unknown>).date as string)
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
          }
        : undefined,
  };
};

export const getUserNotifications = async (
  uid: string
): Promise<AppNotification[]> => {
  if (!uid || uid.trim().length === 0) {
    return [];
  }

  const q = query(
    notificationsCollectionRef(),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(PAGE_LIMIT)
  );

  const snap = await getDocs(q);

  return snap.docs
    .map((docSnap) => normalizeNotification(docSnap.id, docSnap.data()))
    .filter((item): item is AppNotification => item !== null);
};

export const subscribeToUserNotifications = (
  uid: string,
  callback: (notifications: AppNotification[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe => {
  if (!uid || uid.trim().length === 0) {
    callback([]);
    return () => {};
  }

  const q = query(
    notificationsCollectionRef(),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(PAGE_LIMIT)
  );

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((docSnap) => normalizeNotification(docSnap.id, docSnap.data()))
        .filter((item): item is AppNotification => item !== null);

      callback(list);
    },
    onError
  );
};

export const subscribeToUnreadNotificationsCount = (
  uid: string,
  callback: (count: number) => void,
  onError?: (error: unknown) => void
): Unsubscribe => {
  if (!uid || uid.trim().length === 0) {
    callback(0);
    return () => {};
  }

  const q = query(
    notificationsCollectionRef(),
    where('userId', '==', uid),
    where('read', '==', false),
    limit(PAGE_LIMIT)
  );

  return onSnapshot(
    q,
    (snap) => {
      callback(snap.size);
    },
    onError
  );
};

export const markNotificationAsRead = async (
  notificationId: string
): Promise<void> => {
  if (!notificationId || notificationId.trim().length === 0) {
    return;
  }

  await updateDoc(notificationDocRef(notificationId), {
    read: true,
  });
};

export const markAllNotificationsAsRead = async (
  uid: string
): Promise<void> => {
  if (!uid || uid.trim().length === 0) {
    return;
  }

  const unreadQuery = query(
    notificationsCollectionRef(),
    where('userId', '==', uid),
    where('read', '==', false),
    limit(PAGE_LIMIT)
  );

  const snap = await getDocs(unreadQuery);

  if (snap.empty) {
    return;
  }

  const batch = writeBatch(snap.docs[0].ref.firestore);

  snap.docs.forEach((docSnap) => {
    batch.update(docSnap.ref, {
      read: true,
    });
  });

  await batch.commit();
};
