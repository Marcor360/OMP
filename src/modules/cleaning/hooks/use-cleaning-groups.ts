import { useCallback, useEffect, useRef } from 'react';
import { useCleaningCache } from '@/src/modules/cleaning/context/CleaningCacheContext';
import { CleaningGroup } from '@/src/modules/cleaning/types/cleaning-group.types';

interface UseCleaningGroupsResult {
  groups: CleaningGroup[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Carga y gestiona la lista de grupos de limpieza usando el caché. */
export function useCleaningGroups(congregationId: string): UseCleaningGroupsResult {
  const { groups, loading, error, refreshGroups } = useCleaningCache();
  const initialSyncForCongregationRef = useRef<string | null>(null);

  useEffect(() => {
    if (!congregationId) {
      initialSyncForCongregationRef.current = null;
      return;
    }
    if (initialSyncForCongregationRef.current === congregationId) return;

    initialSyncForCongregationRef.current = congregationId;
    void refreshGroups(congregationId);
  }, [congregationId, refreshGroups]);

  const refresh = useCallback(async () => {
    if (congregationId) {
      await refreshGroups(congregationId);
    }
  }, [congregationId, refreshGroups]);

  return { groups, loading: loading && groups.length === 0, error, refresh };
}
