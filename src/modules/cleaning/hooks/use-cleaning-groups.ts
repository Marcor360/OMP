import { useCallback, useEffect } from 'react';
import { useCleaningCache } from '@/src/modules/cleaning/context/CleaningCacheContext';
import { CleaningGroup } from '@/src/modules/cleaning/types/cleaning-group.types';

interface UseCleaningGroupsResult {
  groups: CleaningGroup[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/** Carga y gestiona la lista de grupos de limpieza usando el caché. */
export function useCleaningGroups(congregationId: string): UseCleaningGroupsResult {
  const { groups, loading, error, refreshGroups, lastSyncAt, refreshAll } = useCleaningCache();

  useEffect(() => {
    if (congregationId && !lastSyncAt && !loading && groups.length === 0) {
      void refreshAll(congregationId);
    }
  }, [congregationId, lastSyncAt, loading, groups.length, refreshAll]);

  const refresh = useCallback(() => {
    if (congregationId) {
      void refreshGroups(congregationId);
    }
  }, [congregationId, refreshGroups]);

  return { groups, loading: loading && groups.length === 0, error, refresh };
}
