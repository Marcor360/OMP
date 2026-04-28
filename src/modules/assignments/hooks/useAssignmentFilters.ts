import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  AssignmentCategory,
  AssignmentFilters,
  AssignmentTab,
} from '@/src/modules/assignments/types/assignment.types';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isDateFilterKey = (
  key: keyof AssignmentFilters
): key is 'exactDate' | 'rangeStart' | 'rangeEnd' =>
  key === 'exactDate' || key === 'rangeStart' || key === 'rangeEnd';

const parseDateKey = (value: string): Date | null => {
  const trimmed = value.trim();
  if (!DATE_KEY_PATTERN.test(trimmed)) return null;

  const [yearPart, monthPart, dayPart] = trimmed.split('-');
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};

const resolveCategoryFromDate = (value: string): AssignmentCategory | null => {
  const parsed = parseDateKey(value);
  if (!parsed) return null;

  const weekDay = parsed.getDay();
  return weekDay === 0 || weekDay === 6 ? 'weekend' : 'midweek';
};

const createDefaultFilters = (congregationId: string): AssignmentFilters => ({
  exactDate: '',
  rangeStart: '',
  rangeEnd: '',
  category: 'all',
  subType: 'all',
  assignedPerson: '',
  congregationId,
  status: 'all',
});

export const useAssignmentFilters = (congregationId: string) => {
  const [activeTab, setActiveTab] = useState<AssignmentTab>('all');
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
      const autoCategory =
        isDateFilterKey(key) && typeof value === 'string'
          ? resolveCategoryFromDate(value)
          : null;

      if (autoCategory) {
        setActiveTab(autoCategory);
      }

      setFilters((current) => ({
        ...current,
        [key]: value,
        ...(autoCategory
          ? {
              category: autoCategory,
              subType:
                autoCategory === 'midweek' || autoCategory === 'weekend'
                  ? current.subType
                  : 'all',
            }
          : null),
      }));
    },
    []
  );

  const setCategory = useCallback((category: AssignmentTab) => {
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
    setActiveTab('all');
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
