import { useEffect, useState } from 'react';

import { useUser } from '@/src/context/user-context';
import { subscribeToUnreadNotificationsCount } from '@/src/services/notifications/notificationService';

export const useUnreadNotificationsCount = () => {
  const { uid, congregationId } = useUser();

  const [countState, setCountState] = useState({ ownerUid: null as string | null, count: 0, loading: true });

  useEffect(() => {
    if (!uid) return;

    let active = true;

    const unsubscribe = subscribeToUnreadNotificationsCount(
      uid,
      congregationId,
      (nextCount) => {
        if (active) setCountState({ ownerUid: uid, count: nextCount, loading: false });
      },
      () => {
        if (active) setCountState({ ownerUid: uid, count: 0, loading: false });
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [congregationId, uid]);

  const hasCurrentCount = countState.ownerUid === uid;

  return {
    unreadCount: hasCurrentCount ? countState.count : 0,
    loading: uid ? !hasCurrentCount || countState.loading : false,
  };
};
