import { useCallback, useEffect, useState } from 'react';

import {
  getCurrentMonthId,
  getMyPreachingReport,
  submitPreachingReport,
} from '@/src/services/preaching-report.service';
import {
  PreachingReportFormValues,
  PreachingReportSubmission,
} from '@/src/types/preaching-report.types';
import type { AppUser } from '@/src/types/user';

export const usePreachingReport = ({
  user,
  congregationName,
  monthId = getCurrentMonthId(),
}: {
  user: AppUser | null;
  congregationName?: string;
  monthId?: string;
}) => {
  const [report, setReport] = useState<PreachingReportSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    if (!user?.uid || !user.congregationId) {
      setReport(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const currentReport = await getMyPreachingReport(user.congregationId, monthId, user.uid);
      setReport(currentReport);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar el informe.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [monthId, user?.congregationId, user?.uid]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const submit = useCallback(
    async (values: PreachingReportFormValues) => {
      if (!user) {
        throw new Error('Debes iniciar sesion.');
      }

      setSaving(true);
      setError(null);

      try {
        await submitPreachingReport({
          user,
          monthId,
          congregationName,
          ...values,
        });
        await loadReport();
      } catch (requestError) {
        const message =
          requestError instanceof Error ? requestError.message : 'No se pudo enviar el informe.';
        setError(message);
        throw requestError;
      } finally {
        setSaving(false);
      }
    },
    [congregationName, loadReport, monthId, user]
  );

  return {
    report,
    loading,
    saving,
    error,
    refresh: loadReport,
    submit,
  };
};
