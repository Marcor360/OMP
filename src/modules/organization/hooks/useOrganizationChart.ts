import { useMemo } from 'react';

import { useDepartmentAssignments } from '@/src/modules/organization/hooks/useDepartmentAssignments';
import { buildOrganizationTree } from '@/src/modules/organization/utils/buildOrganizationTree';

export const useOrganizationChart = (congregationId: string | null, canSeed = false) => {
  const data = useDepartmentAssignments(congregationId, canSeed);

  const tree = useMemo(
    () =>
      buildOrganizationTree({
        departments: data.departments,
        assignments: data.assignments,
      }),
    [data.assignments, data.departments]
  );

  return {
    ...data,
    tree,
  };
};
