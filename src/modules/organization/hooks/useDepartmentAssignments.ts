import { useCallback, useEffect, useState } from 'react';

import {
  type Department,
  type DepartmentAssignment,
} from '@/src/modules/organization/types/organization.types';
import {
  getDepartmentAssignments,
  getDepartments,
  seedDefaultDepartments,
} from '@/src/modules/organization/services/organizationService';
import { formatFirestoreError } from '@/src/utils/errors/errors';

export const useDepartmentAssignments = (congregationId: string | null, canSeed = false) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assignments, setAssignments] = useState<DepartmentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!congregationId) {
      setDepartments([]);
      setAssignments([]);
      setLoading(false);
      setError('No hay congregacion activa.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      let loadedDepartments = await getDepartments(congregationId);

      if (loadedDepartments.length === 0 && canSeed) {
        await seedDefaultDepartments(congregationId);
        loadedDepartments = await getDepartments(congregationId);
      }

      const loadedAssignments = await getDepartmentAssignments(congregationId);
      setDepartments(loadedDepartments);
      setAssignments(loadedAssignments);
    } catch (requestError) {
      setError(formatFirestoreError(requestError));
      setDepartments([]);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, [canSeed, congregationId]);

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
