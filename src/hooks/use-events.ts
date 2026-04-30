import { useCallback, useEffect, useState } from 'react';

import { getActiveEvents } from '@/src/services/events/events-service';
import { CongregationEvent } from '@/src/types/event';
import { formatFirestoreError } from '@/src/utils/errors/errors';

export const useEvents = (congregationId: string | null) => {
  const [events, setEvents] = useState<CongregationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (asRefresh = false) => {
      if (!congregationId) {
        setEvents([]);
        setError(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (asRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        setError(null);
        setEvents(await getActiveEvents(congregationId));
      } catch (requestError) {
        setEvents([]);
        setError(formatFirestoreError(requestError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [congregationId]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  return {
    events,
    loading,
    refreshing,
    error,
    refresh: useCallback(() => load(true), [load]),
  };
};
