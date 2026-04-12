import { useCallback, useEffect, useState } from 'react';

import { getUserNotifications } from '@/src/features/notifications/api/getUserNotifications';
import { markAllNotificationsAsRead } from '@/src/features/notifications/api/markAllNotificationsAsRead';
import { markNotificationAsRead } from '@/src/features/notifications/api/markNotificationAsRead';
import { AppNotification } from '@/src/features/notifications/types/notification.types';
import { useUser } from '@/src/context/user-context';
import { subscribeToUserNotifications } from '@/src/services/notifications/notificationService';
import { formatFirestoreError } from '@/src/utils/errors/errors';

export const useNotifications = () => {
  const { uid } = useUser();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setNotifications([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToUserNotifications(
      uid,
      (items) => {
        setNotifications(items);
        setError(null);
        setLoading(false);
      },
      (listenError) => {
        setError(formatFirestoreError(listenError));
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [uid]);

  const refresh = useCallback(async () => {
    if (!uid) {
      setRefreshing(false);
      return;
    }

    setRefreshing(true);

    try {
      const data = await getUserNotifications(uid);
      setNotifications(data);
      setError(null);
    } catch (requestError) {
      setError(formatFirestoreError(requestError));
    } finally {
      setRefreshing(false);
    }
  }, [uid]);

  const markRead = useCallback(async (notificationId: string) => {
    await markNotificationAsRead(notificationId);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!uid) return;
    await markAllNotificationsAsRead(uid);
  }, [uid]);

  return {
    notifications,
    loading,
    refreshing,
    error,
    refresh,
    markRead,
    markAllRead,
  };
};
