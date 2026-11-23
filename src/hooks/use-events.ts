import { useCallback, useEffect, useRef, useState } from 'react';

import { getActiveEvents } from '@/src/services/events/events-service';
import type { CongregationEvent } from '@/src/types/event';
import { formatFirestoreError } from '@/src/utils/errors/errors';

export const useEvents = (congregationId: string | null, uid: string | null) => {
  const scope = uid && congregationId ? JSON.stringify([uid, congregationId]) : null;
  const sequence = useRef(0);
  const [state, setState] = useState<{ scope: string; events: CongregationEvent[]; error: string | null; loading: boolean }>();

  const load = useCallback(async (forceServer = false) => {
    if (!scope || !congregationId) return;
    const sequenceId = ++sequence.current;
    setState((current) => ({ scope, events: current?.scope === scope ? current.events : [], error: null, loading: true }));
    try {
      const events = await getActiveEvents(congregationId, forceServer);
      if (sequenceId === sequence.current) setState({ scope, events, error: null, loading: false });
    } catch (error) {
      if (sequenceId === sequence.current) setState({ scope, events: [], error: formatFirestoreError(error), loading: false });
    }
  }, [congregationId, scope]);

  useEffect(() => {
    void load();
    return () => { sequence.current += 1; };
  }, [load]);

  const current = state?.scope === scope ? state : undefined;
  return {
    events: current?.events ?? [],
    loading: Boolean(scope) && (current?.loading ?? true) && !current?.events.length,
    error: current?.error ?? null,
    reload: useCallback(() => load(), [load]),
    refresh: useCallback(() => load(true), [load]),
  };
};
