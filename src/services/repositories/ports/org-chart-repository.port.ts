import type {
  Department,
  DepartmentAssignmentRole,
  DepartmentPayload,
} from '@/src/types/org-chart';

export type OrgChartRecord = {
  id: string;
  data: Record<string, unknown>;
};

export type OrgChartUserRecord = Record<string, unknown> & {
  uid?: string;
};

export type AssignDepartmentRolePayload = {
  departmentId: string;
  userId: string;
  role: DepartmentAssignmentRole;
  responsibleAssignmentIdsToDeactivate: string[];
  actorUid: string;
};

export type UpdateDepartmentAssignmentRolePayload = {
  assignmentId: string;
  role: DepartmentAssignmentRole;
  responsibleAssignmentIdsToDeactivate: string[];
  actorUid: string;
};

export interface OrgChartRepository {
  listOrgChartUsersForCurrentCongregation(): Promise<OrgChartUserRecord[]>;
  listDepartments(congregationId: string): Promise<OrgChartRecord[]>;
  listAssignments(congregationId: string): Promise<OrgChartRecord[]>;
  initializeDepartmentsIfMissing(
    congregationId: string,
    departments: DepartmentPayload[],
    actorUid: string
  ): Promise<boolean>;
  createDepartment(
    congregationId: string,
    payload: DepartmentPayload,
    actorUid: string
  ): Promise<void>;
  updateDepartment(
    congregationId: string,
    departmentId: string,
    payload: DepartmentPayload,
    actorUid: string
  ): Promise<void>;
  deactivateDepartment(
    congregationId: string,
    departmentId: string,
    assignmentIdsToDeactivate: string[],
    actorUid: string
  ): Promise<void>;
  assignDepartmentRole(
    congregationId: string,
    payload: AssignDepartmentRolePayload
  ): Promise<void>;
  removeDepartmentAssignment(
    congregationId: string,
    assignmentId: string,
    actorUid: string
  ): Promise<void>;
  updateDepartmentAssignmentRole(
    congregationId: string,
    payload: UpdateDepartmentAssignmentRolePayload
  ): Promise<void>;
  reorderDepartments(
    congregationId: string,
    orderedDepartments: Pick<Department, 'id'>[],
    actorUid: string
  ): Promise<void>;
}
