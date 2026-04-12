import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  AssignmentCategory,
  AssignmentFilters,
} from '@/src/modules/assignments/types/assignment.types';

const createDefaultFilters = (congregationId: string): AssignmentFilters => ({
  exactDate: '',
  rangeStart: '',
  rangeEnd: '',
  category: 'midweek',
  subType: 'all',
  assignedPerson: '',
  congregationId,
  status: 'all',
});

export const useAssignmentFilters = (congregationId: string) => {
  const [activeTab, setActiveTab] = useState<AssignmentCategory>('midweek');
  const [filters, setFilters] = useState<AssignmentFilters>(
    createDefaultFilters(congregationId)
  );

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      congregationId,
    }));
  }, [congregationId]);

  const updateFilter = useCallback(
    <K extends keyof AssignmentFilters>(key: K, value: AssignmentFilters[K]) => {
      setFilters((current) => ({
        ...current,
        [key]: value,
      }));
    },
    []
  );

  const setCategory = useCallback((category: AssignmentCategory) => {
    setActiveTab(category);
    setFilters((current) => ({
      ...current,
      category,
      subType:
        category === 'midweek' || category === 'weekend'
          ? current.subType
          : 'all',
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setActiveTab('midweek');
    setFilters(createDefaultFilters(congregationId));
  }, [congregationId]);

  const effectiveFilters = useMemo(
    () => ({
      ...filters,
      congregationId,
      category: activeTab,
      subType:
        activeTab === 'midweek' || activeTab === 'weekend'
          ? filters.subType
          : 'all',
    }),
    [activeTab, congregationId, filters]
  );

  return {
    activeTab,
    filters: effectiveFilters,
    updateFilter,
    setCategory,
    resetFilters,
  };
};
