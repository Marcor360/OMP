import { useCallback, useEffect, useMemo, useState } from 'react';

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

  const loadAssignments = useCallback(
    async (forceServer = false) => {
      if (!congregationId) {
        setAllAssignments([]);
        setError('No se encontro congregacion para cargar asignaciones.');
        setLoading(false);
        setRefreshing(false);
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
      }
    },
    [boundsFilters, congregationId]
  );

  useEffect(() => {
    void loadAssignments(false);
  }, [loadAssignments]);

  // Refresca asignaciones cuando el usuario regresa a esta tab o la app vuelve al primer plano.
  const handleFocusRefresh = useCallback(() => {
    void loadAssignments(false);
  }, [loadAssignments]);

  useRefreshOnFocus(handleFocusRefresh, !loading);

  const summaryFilters = useMemo(
    () => ({
      ...filters,
      category: 'all' as const,
      subType: 'all' as const,
    }),
    [filters]
  );

  const summary = useMemo(
    () => summarizeAssignments(applyAssignmentFilters(allAssignments, summaryFilters)),
    [allAssignments, summaryFilters]
  );

  const assignments = useMemo(
    () => applyAssignmentFilters(allAssignments, filters),
    [allAssignments, filters]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAssignments(true);
  }, [loadAssignments]);

  return {
    assignments,
    allAssignments,
    summary: summary ?? EMPTY_SUMMARY,
    loading,
    refreshing,
    error,
    onRefresh,
    reload: loadAssignments,
  };
};
