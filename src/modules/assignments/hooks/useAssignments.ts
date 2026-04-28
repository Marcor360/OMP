import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getAssignments } from '@/src/modules/assignments/services/assignments.service';
import {
  Assignment,
  AssignmentFilters,
  AssignmentSummary,
} from '@/src/modules/assignments/types/assignment.types';
import {
  applyAssignmentFilters,
  summarizeAssignments,
} from '@/src/modules/assignments/utils/assignment-filters';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { useRefreshOnFocus } from '@/src/hooks/use-refresh-on-focus';

interface UseAssignmentsParams {
  congregationId: string | null;
  filters: AssignmentFilters;
  uid?: string | null;
  cleaningGroupId?: string | null;
  cleaningGroupName?: string | null;
}

const EMPTY_SUMMARY: AssignmentSummary = {
  midweek: 0,
  weekend: 0,
  cleaning: 0,
  hospitality: 0,
};

export const useAssignments = ({
  congregationId,
  filters,
  uid,
  cleaningGroupId,
  cleaningGroupName,
}: UseAssignmentsParams) => {
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const boundsFilters = useMemo(
    () => ({
      exactDate: filters.exactDate,
      rangeStart: filters.rangeStart,
      rangeEnd: filters.rangeEnd,
      category: 'all' as const,
      subType: 'all' as const,
      assignedPerson: '',
      congregationId: filters.congregationId,
      status: 'all' as const,
    }),
    [
      filters.congregationId,
      filters.exactDate,
      filters.rangeEnd,
      filters.rangeStart,
    ]
  );

  const loadingRef = useRef(false);

  const loadAssignments = useCallback(
    async (forceServer = false) => {
      // Evitar llamadas concurrentes
      if (loadingRef.current) return;
      loadingRef.current = true;

      if (!congregationId) {
        setAllAssignments([]);
        setError('No se encontro congregacion para cargar asignaciones.');
        setLoading(false);
        setRefreshing(false);
        loadingRef.current = false;
        return;
      }

      if (!forceServer) {
        setLoading(true);
      }

      try {
        const data = await getAssignments({
          congregationId,
          filters: boundsFilters,
          forceServer,
        });

        setAllAssignments(data);
        setError(null);
      } catch (requestError) {
        setAllAssignments([]);
        setError(formatFirestoreError(requestError));
      } finally {
        setLoading(false);
        setRefreshing(false);
        loadingRef.current = false;
      }
    },
    [boundsFilters, congregationId]
  );

  useEffect(() => {
    void loadAssignments(true);
  }, [loadAssignments]);

  // Refresca asignaciones cuando el usuario regresa a esta tab o la app vuelve al primer plano.
  const handleFocusRefresh = useCallback(() => {
    void loadAssignments(true);
  }, [loadAssignments]);

  useRefreshOnFocus(handleFocusRefresh, true, {
    refreshOnAppActive: false,
    skipInitialFocus: false,
  });

  const summaryFilters = useMemo(
    () => ({
      ...filters,
      category: 'all' as const,
      subType: 'all' as const,
    }),
    [filters]
  );

  const userAssignments = useMemo(() => {
    const normalizedGroupName = cleaningGroupName?.trim().toLowerCase() ?? '';

    return allAssignments.filter((assignment) => {
      if (uid && assignment.assignedUsers.some((person) => person.userId === uid)) {
        return true;
      }

      if (assignment.category !== 'cleaning') {
        return false;
      }

      if (cleaningGroupId) {
        if (assignment.cleaningGroupId === cleaningGroupId) return true;
        if (assignment.assignedUsers.some((person) => person.userId === cleaningGroupId)) {
          return true;
        }
      }

      if (normalizedGroupName.length > 0) {
        if (assignment.cleaningGroupName?.trim().toLowerCase() === normalizedGroupName) {
          return true;
        }

        return assignment.assignedUsers.some(
          (person) => person.name.trim().toLowerCase() === normalizedGroupName
        );
      }

      return false;
    });
  }, [allAssignments, cleaningGroupId, cleaningGroupName, uid]);

  const summary = useMemo(
    () => summarizeAssignments(applyAssignmentFilters(userAssignments, summaryFilters)),
    [summaryFilters, userAssignments]
  );

  const assignments = useMemo(
    () => applyAssignmentFilters(userAssignments, filters),
    [filters, userAssignments]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAssignments(true);
  }, [loadAssignments]);

  return {
    assignments,
    allAssignments: userAssignments,
    summary: summary ?? EMPTY_SUMMARY,
    loading,
    refreshing,
    error,
    onRefresh,
    reload: loadAssignments,
  };
};

