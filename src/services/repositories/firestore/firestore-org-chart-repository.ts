import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from '@/src/lib/firebase/app';
import type {
  AssignDepartmentRolePayload,
  OrgChartRepository,
  OrgChartUserRecord,
  UpdateDepartmentAssignmentRolePayload,
} from '@/src/services/repositories/ports/org-chart-repository.port';
import type { Department, DepartmentPayload } from '@/src/types/org-chart';

const departmentsRef = (congregationId: string) =>
  collection(db, 'congregations', congregationId, 'departments');

const departmentDocRef = (congregationId: string, departmentId: string) =>
  doc(db, 'congregations', congregationId, 'departments', departmentId);

const assignmentsRef = (congregationId: string) =>
  collection(db, 'congregations', congregationId, 'departmentAssignments');

const assignmentDocRef = (congregationId: string, assignmentId: string) =>
  doc(db, 'congregations', congregationId, 'departmentAssignments', assignmentId);

type OrgChartUsersResult = {
  users?: OrgChartUserRecord[];
};

export const firestoreOrgChartRepository: OrgChartRepository = {
  listOrgChartUsersForCurrentCongregation: async (): Promise<OrgChartUserRecord[]> => {
    const callable = httpsCallable<Record<string, never>, OrgChartUsersResult>(
      functions,
      'listOrgChartUsersForCurrentCongregation'
    );
    const result = await callable({});

    return Array.isArray(result.data?.users) ? result.data.users : [];
  },

  listDepartments: async (congregationId: string) => {
    const snap = await getDocs(query(departmentsRef(congregationId)));
    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      data: docSnap.data(),
    }));
  },

  listAssignments: async (congregationId: string) => {
    const snap = await getDocs(query(assignmentsRef(congregationId)));
    return snap.docs.map((docSnap) => ({
      id: docSnap.id,
      data: docSnap.data(),
    }));
  },

  initializeDepartmentsIfMissing: async (
    congregationId: string,
    departments: DepartmentPayload[],
    actorUid: string
  ): Promise<boolean> => {
    const existing = await getDocs(query(departmentsRef(congregationId)));
    if (!existing.empty) return false;

    const batch = writeBatch(db);
    departments.forEach((department) => {
      const ref = doc(departmentsRef(congregationId));
      batch.set(ref, {
        name: department.name.trim(),
        category: department.category,
        parentId: department.parentId ?? null,
        order: department.order ?? 0,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: actorUid,
        updatedBy: actorUid,
      });
    });

    await batch.commit();
    return true;
  },

  createDepartment: async (
    congregationId: string,
    payload: DepartmentPayload,
    actorUid: string
  ): Promise<void> => {
    const batch = writeBatch(db);
    const ref = doc(departmentsRef(congregationId));
    batch.set(ref, {
      name: payload.name.trim(),
      category: payload.category,
      parentId: payload.parentId ?? null,
      order: payload.order ?? 0,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: actorUid,
      updatedBy: actorUid,
    });
    await batch.commit();
  },

  updateDepartment: async (
    congregationId: string,
    departmentId: string,
    payload: DepartmentPayload,
    actorUid: string
  ): Promise<void> => {
    const batch = writeBatch(db);
    batch.update(departmentDocRef(congregationId, departmentId), {
      name: payload.name.trim(),
      category: payload.category,
      parentId: payload.parentId ?? null,
      order: payload.order ?? 0,
      updatedAt: serverTimestamp(),
      updatedBy: actorUid,
    });
    await batch.commit();
  },

  deactivateDepartment: async (
    congregationId: string,
    departmentId: string,
    assignmentIdsToDeactivate: string[],
    actorUid: string
  ): Promise<void> => {
    const batch = writeBatch(db);
    batch.update(departmentDocRef(congregationId, departmentId), {
      isActive: false,
      updatedAt: serverTimestamp(),
      updatedBy: actorUid,
    });

    assignmentIdsToDeactivate.forEach((assignmentId) => {
      batch.update(assignmentDocRef(congregationId, assignmentId), {
        isActive: false,
        updatedAt: serverTimestamp(),
        updatedBy: actorUid,
      });
    });

    await batch.commit();
  },

  assignDepartmentRole: async (
    congregationId: string,
    payload: AssignDepartmentRolePayload
  ): Promise<void> => {
    const batch = writeBatch(db);
    payload.responsibleAssignmentIdsToDeactivate.forEach((assignmentId) => {
      batch.update(assignmentDocRef(congregationId, assignmentId), {
        isActive: false,
        updatedAt: serverTimestamp(),
        updatedBy: payload.actorUid,
      });
    });

    const ref = doc(assignmentsRef(congregationId));
    batch.set(ref, {
      departmentId: payload.departmentId,
      userId: payload.userId,
      assignmentRole: payload.role,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: payload.actorUid,
      updatedBy: payload.actorUid,
    });
    await batch.commit();
  },

  removeDepartmentAssignment: async (
    congregationId: string,
    assignmentId: string,
    actorUid: string
  ): Promise<void> => {
    const batch = writeBatch(db);
    batch.update(assignmentDocRef(congregationId, assignmentId), {
      isActive: false,
      updatedAt: serverTimestamp(),
      updatedBy: actorUid,
    });
    await batch.commit();
  },

  updateDepartmentAssignmentRole: async (
    congregationId: string,
    payload: UpdateDepartmentAssignmentRolePayload
  ): Promise<void> => {
    const batch = writeBatch(db);
    payload.responsibleAssignmentIdsToDeactivate.forEach((assignmentId) => {
      batch.update(assignmentDocRef(congregationId, assignmentId), {
        isActive: false,
        updatedAt: serverTimestamp(),
        updatedBy: payload.actorUid,
      });
    });

    batch.update(assignmentDocRef(congregationId, payload.assignmentId), {
      assignmentRole: payload.role,
      updatedAt: serverTimestamp(),
      updatedBy: payload.actorUid,
    });
    await batch.commit();
  },

  reorderDepartments: async (
    congregationId: string,
    orderedDepartments: Pick<Department, 'id'>[],
    actorUid: string
  ): Promise<void> => {
    const batch = writeBatch(db);
    orderedDepartments.forEach((department, index) => {
      batch.update(departmentDocRef(congregationId, department.id), {
        order: (index + 1) * 10,
        updatedAt: serverTimestamp(),
        updatedBy: actorUid,
      });
    });
    await batch.commit();
  },
};
