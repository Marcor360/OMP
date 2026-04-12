import { useCallback, useEffect, useMemo, useState } from 'react';

import { getCleaningAssignableUsers } from '@/src/modules/cleaning/services/cleaning-service';
import {
  CleaningAssignableUser,
  CleaningMemberStatus,
} from '@/src/modules/cleaning/types/cleaning-group.types';

interface UseCleaningAssignableUsersResult {
  users: CleaningAssignableUser[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  /** Solo los usuarios que pueden ser seleccionados (estado 'available') */
  selectableUsers: CleaningAssignableUser[];
}

/**
 * Carga usuarios asignables a grupos de limpieza de la congregación.
 * Calcula el estado de cada usuario en relación con el grupo actual.
 */
export function useCleaningAssignableUsers(
  congregationId: string,
  currentGroupId: string | null = null
): UseCleaningAssignableUsersResult {
  const [users, setUsers] = useState<CleaningAssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!congregationId) {
      setUsers([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const data = await getCleaningAssignableUsers(congregationId, currentGroupId);
        if (!cancelled) {
          // Ordenar: disponibles primero, luego los del grupo actual, luego bloqueados
          const ORDER: Record<CleaningMemberStatus, number> = {
            available: 0,
            assigned_here: 1,
            assigned_other: 2,
            not_eligible: 3,
            inactive: 4,
          };
          setUsers(
            [...data].sort(
              (a, b) =>
                ORDER[a.memberStatus] - ORDER[b.memberStatus] ||
                a.displayName.localeCompare(b.displayName, 'es')
            )
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Error al cargar los usuarios.'
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
  }, [congregationId, currentGroupId, refreshKey]);

  const selectableUsers = useMemo(
    () => users.filter((u) => u.memberStatus === 'available'),
    [users]
  );

  return { users, loading, error, refresh, selectableUsers };
}
