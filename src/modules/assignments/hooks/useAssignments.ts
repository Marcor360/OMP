import { useCallback, useMemo, useRef, useState } from 'react';

import {
  getMeetingPanelAssignments,
  listStandaloneAssignments,
  mergePanelAssignments,
} from '@/src/modules/assignments/services/assignments.service';
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

type AssignmentLoadResult = {
  scope: string;
  pending: boolean;
  meetings?: Assignment[];
  standalone?: Assignment[];
  meetingsFailed?: boolean;
  standaloneFailed?: boolean;
  error?: string;
};

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
  const [result, setResult] = useState<AssignmentLoadResult>();
  const scope = JSON.stringify([uid, congregationId, filters.exactDate, filters.rangeStart, filters.rangeEnd]);
  const current = result?.scope === scope ? result : undefined;
  const allAssignments = useMemo(
    () => current ? mergePanelAssignments(current.meetings ?? [], current.standalone ?? []) : [],
    [current],
  );
  const loading = congregationId !== null && (!current || (!current.meetings && !current.standalone && current.pending));
  const refreshing = Boolean(current?.pending && !loading);
  const error = current && !current.meetings && !current.standalone ? current.error : undefined;
  const partialError = Boolean(current?.error && (current.meetings || current.standalone));

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

  const inFlight = useRef<{ scope: string; request: Promise<void> } | null>(null);

  const load = useCallback((forceServer: boolean, retry?: { meetings?: boolean; standalone?: boolean }): Promise<void> => {
    if (!congregationId) return Promise.resolve();
    if (inFlight.current?.scope === scope) return inFlight.current.request;

    const update = (patch: Partial<AssignmentLoadResult>) => {
      if (inFlight.current?.request !== request) return;
      setResult((previous) => previous?.scope === scope ? { ...previous, ...patch } : previous);
    };
    setResult((previous) => previous?.scope === scope
      ? { ...previous, pending: true, ...(retry ? {} : { error: undefined }) }
      : { scope, pending: true });

    const jobs: Promise<void>[] = [];
    const run = (source: 'meetings' | 'standalone', query: () => Promise<Assignment[]>) => {
      jobs.push(query().then(
        (data) => update({ [source]: data, [`${source}Failed`]: false }),
        (requestError: unknown) => update({ [`${source}Failed`]: true, error: formatFirestoreError(requestError) }),
      ));
    };
    if (!retry || retry.meetings) {
      run('meetings', () => getMeetingPanelAssignments({ congregationId, filters: boundsFilters, forceServer }));
    }
    if (!retry || retry.standalone) {
      run('standalone', () => listStandaloneAssignments(congregationId, forceServer));
    }
    const request = Promise.all(jobs).then(() => {
      if (inFlight.current?.request !== request) return;
      inFlight.current = null;
      setResult((previous) => {
        if (previous?.scope !== scope) return previous;
        return {
          ...previous, pending: false,
          error: previous.meetingsFailed || previous.standaloneFailed ? previous.error : undefined,
        };
      });
    });
    inFlight.current = { scope, request };
    return request;
  }, [boundsFilters, congregationId, scope]);

  const reload = useCallback((forceServer = true) => load(forceServer), [load]);
  const retryFailed = () => load(true, { meetings: current?.meetingsFailed, standalone: current?.standaloneFailed });
  const refreshOnFocus = useCallback(() => { void reload(); }, [reload]);
  useRefreshOnFocus(refreshOnFocus, true, {
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

  return {
    assignments,
    allAssignments: userAssignments,
    summary: summary ?? EMPTY_SUMMARY,
    loading,
    refreshing,
    error,
    partialError,
    onRefresh: reload,
    retryFailed,
    reload,
  };
};

