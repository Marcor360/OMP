import type {
  Assignment,
} from '@/src/types/assignment';

export type AssignmentFilters = {
  userUid?: string;
  status?: Assignment['status'];
};

export const sortAssignmentsByDueDate = (
  assignments: Assignment[]
): Assignment[] =>
  [...assignments].sort((a, b) => {
    const aDue = a.dueDate?.toMillis?.() ?? 0;
    const bDue = b.dueDate?.toMillis?.() ?? 0;
    return aDue - bDue;
  });

export const normalizeAssignment = (
  meetingId: string,
  id: string,
  data: Record<string, unknown>
): Assignment => {
  const base = { id, ...data } as Assignment;
  return {
    ...base,
    meetingId: base.meetingId ?? meetingId,
  };
};

export const applyAssignmentFilters = (
  assignments: Assignment[],
  filters?: AssignmentFilters
): Assignment[] => {
  if (!filters) return assignments;

  return assignments.filter((assignment) => {
    if (filters.userUid && assignment.assignedToUid !== filters.userUid) {
      return false;
    }

    if (filters.status && assignment.status !== filters.status) {
      return false;
    }

    return true;
  });
};

export const dedupeAssignments = (assignments: Assignment[]): Assignment[] => {
  const byId = new Map<string, Assignment>();

  assignments.forEach((assignment) => {
    const key = `${assignment.meetingId ?? 'none'}:${assignment.id}`;
    byId.set(key, assignment);
  });

  return Array.from(byId.values());
};
