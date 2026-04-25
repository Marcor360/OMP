import { useCallback, useEffect, useRef, useState } from 'react';

import {
  MyCleaningDashboardSummary,
  getMyCleaningDashboardSummary,
} from '@/src/modules/cleaning/services/my-cleaning-dashboard-service';
import { formatFirestoreError } from '@/src/utils/errors/errors';

interface UseMyCleaningDashboardParams {
  uid: string | null;
  congregationId: string | null;
  cleaningGroupId?: string | null;
  cleaningGroupName?: string | null;
  enabled?: boolean;
}

interface UseMyCleaningDashboardResult {
  summary: MyCleaningDashboardSummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useMyCleaningDashboard = ({
  uid,
  congregationId,
  cleaningGroupId,
  cleaningGroupName,
  enabled = true,
}: UseMyCleaningDashboardParams): UseMyCleaningDashboardResult => {
  const [summary, setSummary] = useState<MyCleaningDashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const hasSummaryRef = useRef(false);

  const load = useCallback(
    async (forceServer = false) => {
      if (!enabled || !uid || !congregationId) {
        setSummary(null);
        hasSummaryRef.current = false;
        setLoading(false);
        setError(null);
        return;
      }

      if (loadingRef.current) return;
      loadingRef.current = true;
      if (!hasSummaryRef.current || forceServer) setLoading(true);

      try {
        const data = await getMyCleaningDashboardSummary({
          uid,
          congregationId,
          cleaningGroupId,
          cleaningGroupName,
          forceServer,
        });

        setSummary(data);
        hasSummaryRef.current = true;
        setError(null);
      } catch (requestError) {
        setError(formatFirestoreError(requestError));
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    [cleaningGroupId, cleaningGroupName, congregationId, enabled, uid]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return {
    summary,
    loading,
    error,
    refresh,
  };
};
