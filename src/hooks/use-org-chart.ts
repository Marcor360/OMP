import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  addDepartmentAssistant,
  assignDepartmentResponsible,
  buildOrgChart,
  createDepartment,
  deactivateDepartment,
  getActiveDepartmentAssignments,
  getActiveDepartments,
  getEligibleUsersForDepartmentAssignments,
  getOrgChartUsersForCurrentCongregation,
  initializeDepartmentsIfMissing,
  removeDepartmentAssignment,
  reorderDepartments,
  updateDepartment,
  updateDepartmentAssignmentRole,
} from '@/src/services/org-chart/org-chart-service';
import type {
  Department,
  DepartmentAssignmentRole,
  DepartmentPayload,
} from '@/src/types/org-chart';
import type { AppUser } from '@/src/types/user';

export function useOrgChart(congregationId: string | null, currentUser: AppUser | null) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assignments, setAssignments] = useState<Awaited<ReturnType<typeof getActiveDepartmentAssignments>>>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(Boolean(congregationId && currentUser));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!congregationId || !currentUser) {
      setDepartments([]);
      setAssignments([]);
      setUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [nextDepartments, nextAssignments, congregationUsers] = await Promise.all([
        getActiveDepartments(congregationId),
        getActiveDepartmentAssignments(congregationId),
        getOrgChartUsersForCurrentCongregation(congregationId),
      ]);
      setDepartments(nextDepartments);
      setAssignments(nextAssignments);
      setUsers(await getEligibleUsersForDepartmentAssignments(congregationId, congregationUsers));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el organigrama.');
    } finally {
      setLoading(false);
    }
  }, [congregationId, currentUser]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runMutation = useCallback(
    async (action: () => Promise<void>) => {
      setSaving(true);
      try {
        await action();
        await refresh();
      } finally {
        setSaving(false);
      }
    },
    [refresh]
  );

  const requireContext = useCallback(() => {
    if (!congregationId || !currentUser) {
      throw new Error('No hay contexto de congregacion activo.');
    }
    return { congregationId, currentUser };
  }, [congregationId, currentUser]);

  const chart = useMemo(
    () => buildOrgChart(departments, assignments, users),
    [assignments, departments, users]
  );

  return {
    departments,
    assignments,
    users,
    chart,
    loading,
    saving,
    error,
    refresh,
    initialize: () =>
      runMutation(async () => {
        const context = requireContext();
        await initializeDepartmentsIfMissing(context.congregationId, context.currentUser);
      }),
    createDepartment: (payload: DepartmentPayload) =>
      runMutation(async () => {
        const context = requireContext();
        await createDepartment(context.congregationId, payload, context.currentUser);
      }),
    updateDepartment: (departmentId: string, payload: DepartmentPayload) =>
      runMutation(async () => {
        const context = requireContext();
        await updateDepartment(context.congregationId, departmentId, payload, context.currentUser);
      }),
    deactivateDepartment: (departmentId: string) =>
      runMutation(async () => {
        const context = requireContext();
        await deactivateDepartment(context.congregationId, departmentId, context.currentUser);
      }),
    assignResponsible: (departmentId: string, userId: string) =>
      runMutation(async () => {
        const context = requireContext();
        await assignDepartmentResponsible(context.congregationId, departmentId, userId, context.currentUser);
      }),
    addAssistant: (departmentId: string, userId: string) =>
      runMutation(async () => {
        const context = requireContext();
        await addDepartmentAssistant(context.congregationId, departmentId, userId, context.currentUser);
      }),
    removeAssignment: (assignmentId: string) =>
      runMutation(async () => {
        const context = requireContext();
        await removeDepartmentAssignment(context.congregationId, assignmentId, context.currentUser);
      }),
    updateAssignmentRole: (assignmentId: string, role: DepartmentAssignmentRole) =>
      runMutation(async () => {
        const context = requireContext();
        await updateDepartmentAssignmentRole(context.congregationId, assignmentId, role, context.currentUser);
      }),
    reorderDepartments: (orderedDepartments: Department[]) =>
      runMutation(async () => {
        const context = requireContext();
        await reorderDepartments(context.congregationId, orderedDepartments, context.currentUser);
      }),
  };
}
