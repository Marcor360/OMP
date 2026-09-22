import { useCallback, useEffect, useState } from 'react';

import { getUserNotifications } from '@/src/features/notifications/api/getUserNotifications';
import { markAllNotificationsAsRead } from '@/src/features/notifications/api/markAllNotificationsAsRead';
import { markNotificationAsRead } from '@/src/features/notifications/api/markNotificationAsRead';
import { AppNotification } from '@/src/features/notifications/types/notification.types';
import { useUser } from '@/src/context/user-context';
import { subscribeToUserNotifications } from '@/src/services/notifications/notificationService';
import { formatFirestoreError } from '@/src/utils/errors/errors';

export const useNotifications = () => {
  const { uid, congregationId } = useUser();

  const [notificationState, setNotificationState] = useState<{
    ownerUid: string | null;
    notifications: AppNotification[];
    loading: boolean;
    error: string | null;
  }>({ ownerUid: null, notifications: [], loading: true, error: null });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!uid) return;

    let active = true;

    const unsubscribe = subscribeToUserNotifications(
      uid,
      congregationId,
      (items) => {
        if (!active) return;
        setNotificationState({ ownerUid: uid, notifications: items, loading: false, error: null });
      },
      (listenError) => {
        if (!active) return;
        setNotificationState((current) => ({
          ownerUid: uid,
          notifications: current.ownerUid === uid ? current.notifications : [],
          loading: false,
          error: formatFirestoreError(listenError),
        }));
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [congregationId, uid]);

  const refresh = useCallback(async () => {
    if (!uid) {
      setRefreshing(false);
      return;
    }

    setRefreshing(true);

    try {
      const data = await getUserNotifications(uid, congregationId);
      setNotificationState({ ownerUid: uid, notifications: data, loading: false, error: null });
    } catch (requestError) {
      setNotificationState((current) => current.ownerUid === uid
        ? { ...current, error: formatFirestoreError(requestError) }
        : current);
    } finally {
      setRefreshing(false);
    }
  }, [congregationId, uid]);

  const markRead = useCallback(async (notificationId: string) => {
    await markNotificationAsRead(notificationId, congregationId);
  }, [congregationId]);

  const markAllRead = useCallback(async () => {
    if (!uid) return 0;
    return markAllNotificationsAsRead(uid, congregationId);
  }, [congregationId, uid]);

  const hasCurrentNotifications = notificationState.ownerUid === uid;

  return {
    notifications: hasCurrentNotifications ? notificationState.notifications : [],
    loading: uid ? !hasCurrentNotifications || notificationState.loading : false,
    refreshing,
    error: hasCurrentNotifications ? notificationState.error : null,
    refresh,
    markRead,
    markAllRead,
  };
};
