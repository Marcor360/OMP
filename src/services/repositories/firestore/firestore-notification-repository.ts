import {
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
  congregationNotificationDocRef,
  congregationNotificationsCollectionRef,
} from '@/src/lib/firebase/refs';
import type {
  NotificationRecord,
  NotificationRepository,
} from '@/src/services/repositories/ports/notification-repository.port';

const PAGE_LIMIT = 100;

export const firestoreNotificationRepository: NotificationRepository = {
  list: async (
    congregationId: string,
    userId: string
  ): Promise<NotificationRecord[]> => {
    const q = query(
      congregationNotificationsCollectionRef(congregationId),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(PAGE_LIMIT)
    );

    const snap = await getDocs(q);

    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      data: docSnap.data(),
    }));
  },

  subscribeUserNotifications: (
    congregationId: string,
    userId: string,
    callback: (notifications: NotificationRecord[]) => void,
    onError?: (error: unknown) => void
  ) => {
    const q = query(
      congregationNotificationsCollectionRef(congregationId),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(PAGE_LIMIT)
    );

    return onSnapshot(
      q,
      (snap) => {
        callback(
          snap.docs.map((docSnap) => ({
            id: docSnap.id,
            data: docSnap.data(),
          }))
        );
      },
      onError
    );
  },

  subscribeUnreadCount: (
    congregationId: string,
    userId: string,
    callback: (notifications: NotificationRecord[]) => void,
    onError?: (error: unknown) => void
  ) => {
    const q = query(
      congregationNotificationsCollectionRef(congregationId),
      where('userId', '==', userId),
      where('isRead', '==', false),
      limit(PAGE_LIMIT)
    );

    return onSnapshot(
      q,
      (snap) => {
        callback(
          snap.docs.map((docSnap) => ({
            id: docSnap.id,
            data: docSnap.data(),
          }))
        );
      },
      onError
    );
  },

  markAsRead: async (
    congregationId: string,
    notificationId: string
  ): Promise<void> => {
    await updateDoc(congregationNotificationDocRef(congregationId, notificationId), {
      isRead: true,
    });
  },

  markAllAsRead: async (
    congregationId: string,
    userId: string
  ): Promise<void> => {
    const unreadQuery = query(
      congregationNotificationsCollectionRef(congregationId),
      where('userId', '==', userId),
      where('isRead', '==', false),
      limit(PAGE_LIMIT)
    );

    const snap = await getDocs(unreadQuery);

    if (snap.empty) {
      return;
    }

    const batch = writeBatch(snap.docs[0].ref.firestore);

    snap.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, {
        isRead: true,
      });
    });

    await batch.commit();
  },
};
