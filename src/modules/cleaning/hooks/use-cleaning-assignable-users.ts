import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useCleaningCache } from '@/src/modules/cleaning/context/CleaningCacheContext';
import {
  CleaningAssignableUser,
  CleaningMemberStatus,
} from '@/src/modules/cleaning/types/cleaning-group.types';

interface UseCleaningAssignableUsersResult {
  users: CleaningAssignableUser[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  selectableUsers: CleaningAssignableUser[];
}

const deriveStatus = (
  user: CleaningAssignableUser,
  currentGroupId: string | null
): CleaningMemberStatus => {
  if (!user.isActive) return 'inactive';
  if (!user.cleaningEligible) return 'not_eligible';
  if (!user.cleaningGroupId) return 'available';
  if (currentGroupId && user.cleaningGroupId === currentGroupId) return 'assigned_here';
  return 'assigned_other';
};

/**
 * Carga usuarios asignables a grupos de limpieza consumiendo caché.
 * Calcula el estado de cada usuario en relación con el grupo actual localmente.
 */
export function useCleaningAssignableUsers(
  congregationId: string,
  currentGroupId: string | null = null
): UseCleaningAssignableUsersResult {
  const { assignableUsers, loading, error, refreshUsers } = useCleaningCache();
  const initialSyncForCongregationRef = useRef<string | null>(null);

  useEffect(() => {
    // Si no tenemos sincro inicial y no está cargando el general, disparamos
    if (!congregationId) {
      initialSyncForCongregationRef.current = null;
      return;
    }
    if (initialSyncForCongregationRef.current === congregationId) return;

    initialSyncForCongregationRef.current = congregationId;
    void refreshUsers(congregationId, null);
  }, [congregationId, refreshUsers]);

  const refresh = useCallback(async () => {
    if (congregationId) {
      // Pedimos refresh de datos base (currentGroupId=null) al caché para evitar contaminar el scope global
      await refreshUsers(congregationId, null);
    }
  }, [congregationId, refreshUsers]);

  // Recalcular estados dinámicamente según el grupo elegido
  const users = useMemo(() => {
    const ORDER: Record<CleaningMemberStatus, number> = {
      available: 0,
      assigned_here: 1,
      assigned_other: 2,
      not_eligible: 3,
      inactive: 4,
    };

    const derived = assignableUsers.map((u) => ({
      ...u,
      memberStatus: deriveStatus(u, currentGroupId),
    }));

    return derived.sort(
      (a, b) =>
        ORDER[a.memberStatus] - ORDER[b.memberStatus] ||
        a.displayName.localeCompare(b.displayName, 'es')
    );
  }, [assignableUsers, currentGroupId]);

  const selectableUsers = useMemo(
    () => users.filter((u) => u.memberStatus === 'available'),
    [users]
  );

  return { users, loading: loading && users.length === 0, error, refresh, selectableUsers };
}
