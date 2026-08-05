import {
  documentId,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type {
  DocumentData,
  Query,
  QueryDocumentSnapshot,
  QuerySnapshot,
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
const MARK_ALL_BATCH_LIMIT = 400;

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
      readAt: serverTimestamp(),
    });
  },

  markAllAsRead: async (
    congregationId: string,
    userId: string
  ): Promise<number> => {
    let totalUpdated = 0;
    let cursor: QueryDocumentSnapshot<DocumentData> | null = null;

    while (true) {
      const unreadQuery: Query<DocumentData> = cursor
        ? query(
            congregationNotificationsCollectionRef(congregationId),
            where('userId', '==', userId),
            where('isRead', '==', false),
            orderBy(documentId()),
            startAfter(cursor),
            limit(MARK_ALL_BATCH_LIMIT)
          )
        : query(
            congregationNotificationsCollectionRef(congregationId),
            where('userId', '==', userId),
            where('isRead', '==', false),
            orderBy(documentId()),
            limit(MARK_ALL_BATCH_LIMIT)
          );
      const snap: QuerySnapshot<DocumentData> = await getDocs(unreadQuery);

      if (snap.empty) break;

      const batch = writeBatch(snap.docs[0].ref.firestore);
      snap.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          isRead: true,
          readAt: serverTimestamp(),
        });
      });
      await batch.commit();

      totalUpdated += snap.size;
      cursor = snap.docs[snap.docs.length - 1];

      if (snap.size < MARK_ALL_BATCH_LIMIT) break;
    }

    return totalUpdated;
  },
};
