import { useCallback, useEffect, useState } from 'react';

import {
  type Department,
  type DepartmentAssignment,
} from '@/src/modules/organization/types/organization.types';
import {
  getDepartmentAssignments,
  getDepartments,
} from '@/src/modules/organization/services/organizationService';
import { isPermissionDeniedError } from '@/src/utils/errors/errors';

export const useDepartmentAssignments = (congregationId: string | null) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assignments, setAssignments] = useState<DepartmentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!congregationId) {
      setDepartments([]);
      setAssignments([]);
      setLoading(false);
      setError('No se pudo identificar la congregacion del usuario.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const [loadedDepartments, loadedAssignments] = await Promise.all([
        getDepartments(congregationId),
        getDepartmentAssignments(congregationId),
      ]);
      setDepartments(loadedDepartments);
      setAssignments(loadedAssignments);
    } catch (requestError) {
      setError(
        isPermissionDeniedError(requestError)
          ? 'No se pudo leer el organigrama. Verifica que tu usuario este activo y pertenezca a esta congregacion.'
          : 'No se pudo cargar el organigrama.'
      );
      setDepartments([]);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [congregationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    departments,
    assignments,
    loading,
    error,
    refresh,
  };
};
