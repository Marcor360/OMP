import { useCallback, useEffect, useState } from 'react';

import { getCleaningGroups } from '@/src/modules/cleaning/services/cleaning-service';
import { CleaningGroup } from '@/src/modules/cleaning/types/cleaning-group.types';

interface UseCleaningGroupsResult {
  groups: CleaningGroup[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/** Carga y gestiona la lista de grupos de limpieza de una congregación. */
export function useCleaningGroups(congregationId: string): UseCleaningGroupsResult {
  const [groups, setGroups] = useState<CleaningGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!congregationId) {
      setGroups([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const data = await getCleaningGroups(congregationId);
        if (!cancelled) setGroups(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Error al cargar los grupos de limpieza.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [congregationId, refreshKey]);

  return { groups, loading, error, refresh };
}
