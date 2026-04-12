import { useEffect, useState } from 'react';

import { useUser } from '@/src/context/user-context';
import { subscribeToUnreadNotificationsCount } from '@/src/services/notifications/notificationService';

export const useUnreadNotificationsCount = () => {
  const { uid } = useUser();

  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToUnreadNotificationsCount(
      uid,
      (nextCount) => {
        setCount(nextCount);
        setLoading(false);
      },
      () => {
        setCount(0);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [uid]);

  return {
    unreadCount: count,
    loading,
  };
};
