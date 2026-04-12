import { useCallback, useEffect, useState } from 'react';

import { getCleaningGroupById } from '@/src/modules/cleaning/services/cleaning-service';
import { CleaningGroup } from '@/src/modules/cleaning/types/cleaning-group.types';

interface UseCleaningGroupDetailResult {
  group: CleaningGroup | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/** Carga el detalle de un grupo de limpieza por su ID. */
export function useCleaningGroupDetail(groupId: string): UseCleaningGroupDetailResult {
  const [group, setGroup] = useState<CleaningGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!groupId) {
      setGroup(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const data = await getCleaningGroupById(groupId);
        if (!cancelled) {
          setGroup(data);
          if (!data) setError('El grupo no fue encontrado.');
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Error al cargar el grupo.'
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
  }, [groupId, refreshKey]);

  return { group, loading, error, refresh };
}
