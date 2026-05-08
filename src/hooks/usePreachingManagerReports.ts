import { useCallback, useEffect, useMemo, useState } from 'react';

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
  const [activeUsers, setActiveUsers] = useState<AppUser[]>([]);
  const [submissions, setSubmissions] = useState<PreachingReportSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled || !congregationId) {
      setActiveUsers([]);
      setSubmissions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [users, reports] = await Promise.all([
        getActiveUsers(congregationId),
        getMonthlyPreachingReportsForManager(congregationId, monthId),
      ]);
      setActiveUsers(users);
      setSubmissions(reports);
    } catch (requestError) {
      setActiveUsers([]);
      setSubmissions([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'No se pudieron cargar los informes.'
      );
    } finally {
      setLoading(false);
    }
  }, [congregationId, enabled, monthId]);

  useEffect(() => {
    void load();
  }, [load]);

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
    refresh: load,
  };
};
