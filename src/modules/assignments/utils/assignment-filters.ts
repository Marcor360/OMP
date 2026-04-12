import {
  Assignment,
  AssignmentCategory,
  AssignmentFilters,
  AssignmentSummary,
} from '@/src/modules/assignments/types/assignment.types';

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

const toDate = (value: string | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const toDateKey = (value: string): string => {
  const parsed = toDate(value);
  if (!parsed) return '';
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeDateInput = (value: string): string => {
  const trimmed = value.trim();

  if (dateOnlyPattern.test(trimmed)) {
    return trimmed;
  }

  const parsed = toDate(trimmed);
  if (!parsed) return '';
  return toDateKey(parsed.toISOString());
};

export const sortAssignments = (assignments: Assignment[]): Assignment[] => {
  return [...assignments].sort((left, right) => {
    const leftTime = toDate(left.date)?.getTime() ?? 0;
    const rightTime = toDate(right.date)?.getTime() ?? 0;

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return left.sourceKey.localeCompare(right.sourceKey);
  });
};

export const applyAssignmentFilters = (
  assignments: Assignment[],
  filters: AssignmentFilters
): Assignment[] => {
  const exactDate = normalizeDateInput(filters.exactDate);
  const rangeStart = normalizeDateInput(filters.rangeStart);
  const rangeEnd = normalizeDateInput(filters.rangeEnd);
  const personSearch = filters.assignedPerson.trim().toLowerCase();
  const congregationSearch = filters.congregationId.trim().toLowerCase();

  const filtered = assignments.filter((assignment) => {
    if (congregationSearch.length > 0) {
      if (!assignment.congregationId.toLowerCase().includes(congregationSearch)) {
        return false;
      }
    }

    if (filters.category !== 'all' && assignment.category !== filters.category) {
      return false;
    }

    if (filters.status !== 'all' && assignment.status !== filters.status) {
      return false;
    }

    if (
      filters.subType !== 'all' &&
      (assignment.category === 'midweek' || assignment.category === 'weekend') &&
      assignment.subType !== filters.subType
    ) {
      return false;
    }

    if (personSearch.length > 0) {
      const hasPerson = assignment.assignedUsers.some((person) =>
        person.name.toLowerCase().includes(personSearch)
      );

      if (!hasPerson) {
        return false;
      }
    }

    const assignmentDateKey = toDateKey(assignment.date);
    if (!assignmentDateKey) return false;

    if (exactDate.length > 0) {
      return assignmentDateKey === exactDate;
    }

    if (rangeStart.length > 0 && assignmentDateKey < rangeStart) {
      return false;
    }

    if (rangeEnd.length > 0 && assignmentDateKey > rangeEnd) {
      return false;
    }

    return true;
  });

  return sortAssignments(filtered);
};

export const summarizeAssignments = (assignments: Assignment[]): AssignmentSummary => {
  return assignments.reduce<AssignmentSummary>(
    (summary, assignment) => {
      summary[assignment.category] += 1;
      return summary;
    },
    {
      midweek: 0,
      weekend: 0,
      cleaning: 0,
      hospitality: 0,
    }
  );
};

export const getAssignmentsByCategory = (
  assignments: Assignment[],
  category: AssignmentCategory
): Assignment[] => assignments.filter((assignment) => assignment.category === category);

export const toFilterDateKey = (value: string): string => normalizeDateInput(value);
