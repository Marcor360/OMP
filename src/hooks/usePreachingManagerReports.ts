import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getCurrentMonthId,
  getMonthlyPreachingReportsForManager,
  getPreachingReportSummary,
} from '@/src/services/preaching-report.service';
import { getActiveUsers } from '@/src/services/users/users-service';
import {
  MissingPreachingReportUser,
  PreachingReportSubmission,
} from '@/src/types/preaching-report.types';
import type { AppUser } from '@/src/types/user';

const EMPTY_USERS: AppUser[] = [];
const EMPTY_REPORTS: PreachingReportSubmission[] = [];

export const usePreachingManagerReports = ({
  congregationId,
  enabled,
  monthId: initialMonthId = getCurrentMonthId(),
}: {
  congregationId: string | null;
  enabled: boolean;
  monthId?: string;
}) => {
  const [monthId, setMonthId] = useState(initialMonthId);
  const scope = JSON.stringify([congregationId, monthId]);
  const [result, setResult] = useState<{
    scope: string; users: AppUser[]; reports: PreachingReportSubmission[];
  }>();
  const [failure, setFailure] = useState<{ scope: string; message: string }>();
  const [pending, setPending] = useState<string>();
  const request = useRef(0);
  const current = enabled && result?.scope === scope ? result : undefined;
  const error = enabled && failure?.scope === scope ? failure.message : null;
  const loading = Boolean(enabled && congregationId && (pending === scope || (!current && !error)));
  const activeUsers = current?.users ?? EMPTY_USERS;
  const submissions = current?.reports ?? EMPTY_REPORTS;

  const load = useCallback(async (forceServer = false) => {
    if (!enabled || !congregationId) return;
    const id = ++request.current;
    setPending(scope);
    setFailure(undefined);
    try {
      const [users, reports] = await Promise.all([
        getActiveUsers(congregationId),
        getMonthlyPreachingReportsForManager(congregationId, monthId, forceServer),
      ]);
      if (id === request.current) setResult({ scope, users, reports });
    } catch (error) {
      if (id === request.current) setFailure({ scope, message: error instanceof Error ? error.message : 'No se pudieron cargar los informes.' });
    } finally {
      if (id === request.current) setPending(undefined);
    }
  }, [congregationId, enabled, monthId, scope]);

  useEffect(() => {
    void load();
    return () => { request.current += 1; };
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);
  const missingUsers = useMemo<MissingPreachingReportUser[]>(() => {
    const submittedUserIds = new Set(submissions.map((submission) => submission.userId));
    return activeUsers
      .filter((user) => !submittedUserIds.has(user.uid))
      .map((user) => ({
        uid: user.uid,
        displayName: user.displayName,
        privileges: user.privileges,
      }));
  }, [activeUsers, submissions]);

  const summary = useMemo(
    () => getPreachingReportSummary(activeUsers, submissions),
    [activeUsers, submissions]
  );

  return {
    monthId,
    setMonthId,
    submissions,
    missingUsers,
    summary,
    loading,
    error,
    ready: Boolean(current) && !loading && error === null,
    refresh,
  };
};
