import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/src/lib/firebase/app';
import type {
  Department,
  DepartmentAssignment,
  DepartmentAssignmentRole,
  DepartmentCategory,
  DepartmentPayload,
  OrgChartCategoryGroup,
} from '@/src/types/org-chart';
import {
  DEPARTMENT_CATEGORIES,
  INITIAL_DEPARTMENT_TEMPLATE,
} from '@/src/types/org-chart';
import type { AppUser } from '@/src/types/user';
import {
  canManageDepartments,
} from '@/src/utils/permissions/permissions';

const departmentsRef = (congregationId: string) =>
  collection(db, 'congregations', congregationId, 'departments');

const departmentDocRef = (congregationId: string, departmentId: string) =>
  doc(db, 'congregations', congregationId, 'departments', departmentId);

const assignmentsRef = (congregationId: string) =>
  collection(db, 'congregations', congregationId, 'departmentAssignments');

const assignmentDocRef = (congregationId: string, assignmentId: string) =>
  doc(db, 'congregations', congregationId, 'departmentAssignments', assignmentId);

const normalizeDepartment = (id: string, data: Record<string, unknown>): Department => ({
  id,
  name: typeof data.name === 'string' ? data.name : '',
  category: DEPARTMENT_CATEGORIES.includes(data.category as DepartmentCategory)
    ? (data.category as DepartmentCategory)
    : 'other',
  parentId: typeof data.parentId === 'string' ? data.parentId : null,
  order: typeof data.order === 'number' ? data.order : 0,
  isActive: data.isActive === true,
  createdAt: (data.createdAt as Department['createdAt']) ?? null,
  updatedAt: (data.updatedAt as Department['updatedAt']) ?? null,
  createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
  updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
});

const normalizeAssignment = (
  id: string,
  data: Record<string, unknown>
): DepartmentAssignment => ({
  id,
  departmentId: typeof data.departmentId === 'string' ? data.departmentId : '',
  userId: typeof data.userId === 'string' ? data.userId : '',
  assignmentRole: data.assignmentRole === 'assistant' ? 'assistant' : 'responsible',
  isActive: data.isActive === true,
  createdAt: (data.createdAt as DepartmentAssignment['createdAt']) ?? null,
  updatedAt: (data.updatedAt as DepartmentAssignment['updatedAt']) ?? null,
  createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
  updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
});

const assertCongregationContext = (congregationId: string, currentUser: AppUser) => {
  if (!congregationId.trim()) {
    throw new Error('No hay congregacion activa.');
  }

  if (!currentUser?.uid || currentUser.congregationId !== congregationId || currentUser.isActive !== true) {
    throw new Error('Usuario actual invalido para esta congregacion.');
  }
};

const assertCanManage = (congregationId: string, currentUser: AppUser) => {
  assertCongregationContext(congregationId, currentUser);
  if (!canManageDepartments(currentUser)) {
    throw new Error('No tienes permisos para administrar el organigrama.');
  }
};

const assertDepartmentPayload = (payload: DepartmentPayload) => {
  if (!payload.name.trim()) {
    throw new Error('El nombre del departamento es obligatorio.');
  }

  if (!DEPARTMENT_CATEGORIES.includes(payload.category)) {
    throw new Error('Categoria de departamento invalida.');
  }
};

const getAllDepartments = async (congregationId: string): Promise<Department[]> => {
  const snap = await getDocs(query(departmentsRef(congregationId)));
  return snap.docs
    .map((docSnap) => normalizeDepartment(docSnap.id, docSnap.data()))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es'));
};

const getAllAssignments = async (congregationId: string): Promise<DepartmentAssignment[]> => {
  const snap = await getDocs(query(assignmentsRef(congregationId)));
  return snap.docs.map((docSnap) => normalizeAssignment(docSnap.id, docSnap.data()));
};

export const getActiveDepartments = async (congregationId: string): Promise<Department[]> =>
  (await getAllDepartments(congregationId)).filter((department) => department.isActive);

export const getActiveDepartmentAssignments = async (
  congregationId: string
): Promise<DepartmentAssignment[]> =>
  (await getAllAssignments(congregationId)).filter((assignment) => assignment.isActive);

export const getEligibleUsersForDepartmentAssignments = async (
  congregationId: string,
  users: AppUser[]
): Promise<AppUser[]> =>
  users
    .filter((user) => user.isActive === true && user.congregationId === congregationId)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));

export const initializeDepartmentsIfMissing = async (
  congregationId: string,
  currentUser: AppUser
): Promise<boolean> => {
  assertCanManage(congregationId, currentUser);

  const existing = await getDocs(query(departmentsRef(congregationId)));
  if (!existing.empty) return false;

  const batch = writeBatch(db);
  INITIAL_DEPARTMENT_TEMPLATE.forEach((department) => {
    const ref = doc(departmentsRef(congregationId));
    batch.set(ref, {
      name: department.name.trim(),
      category: department.category,
      parentId: department.parentId ?? null,
      order: department.order ?? 0,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: currentUser.uid,
      updatedBy: currentUser.uid,
    });
  });

  await batch.commit();
  return true;
};

export const createDepartment = async (
  congregationId: string,
  payload: DepartmentPayload,
  currentUser: AppUser
): Promise<void> => {
  assertCanManage(congregationId, currentUser);
  assertDepartmentPayload(payload);

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
    createdBy: currentUser.uid,
    updatedBy: currentUser.uid,
  });
  await batch.commit();
};

export const updateDepartment = async (
  congregationId: string,
  departmentId: string,
  payload: DepartmentPayload,
  currentUser: AppUser
): Promise<void> => {
  assertCanManage(congregationId, currentUser);
  assertDepartmentPayload(payload);

  const batch = writeBatch(db);
  batch.update(departmentDocRef(congregationId, departmentId), {
    name: payload.name.trim(),
    category: payload.category,
    parentId: payload.parentId ?? null,
    order: payload.order ?? 0,
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid,
  });
  await batch.commit();
};

export const deactivateDepartment = async (
  congregationId: string,
  departmentId: string,
  currentUser: AppUser
): Promise<void> => {
  assertCanManage(congregationId, currentUser);

  const assignments = await getActiveDepartmentAssignments(congregationId);
  const batch = writeBatch(db);
  batch.update(departmentDocRef(congregationId, departmentId), {
    isActive: false,
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid,
  });
  assignments
    .filter((assignment) => assignment.departmentId === departmentId)
    .forEach((assignment) => {
      batch.update(assignmentDocRef(congregationId, assignment.id), {
        isActive: false,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid,
      });
    });
  await batch.commit();
};

const assertAssignmentTarget = async (
  congregationId: string,
  departmentId: string,
  userId: string
) => {
  const [departments, usersSnap] = await Promise.all([
    getActiveDepartments(congregationId),
    getDocs(query(collection(db, 'users'), where('congregationId', '==', congregationId), where('isActive', '==', true))),
  ]);
  const department = departments.find((item) => item.id === departmentId);
  if (!department) throw new Error('Departamento no encontrado o inactivo.');

  const userDoc = usersSnap.docs
    .map((snap): Record<string, unknown> & { id: string } => ({ id: snap.id, ...snap.data() }))
    .find((item) => item.id === userId);
  if (!userDoc || userDoc.congregationId !== congregationId || userDoc.isActive !== true) {
    throw new Error('El usuario seleccionado no es elegible.');
  }
};

const assignDepartmentRole = async (
  congregationId: string,
  departmentId: string,
  userId: string,
  role: DepartmentAssignmentRole,
  currentUser: AppUser
) => {
  assertCanManage(congregationId, currentUser);
  await assertAssignmentTarget(congregationId, departmentId, userId);

  const assignments = await getActiveDepartmentAssignments(congregationId);
  const duplicateInDepartment = assignments.find(
    (assignment) => assignment.departmentId === departmentId && assignment.userId === userId
  );
  if (duplicateInDepartment && duplicateInDepartment.assignmentRole !== role) {
    throw new Error('Este usuario ya tiene otra asignacion activa en este departamento.');
  }
  if (duplicateInDepartment?.assignmentRole === role) return;

  const batch = writeBatch(db);
  if (role === 'responsible') {
    assignments
      .filter(
        (assignment) =>
          assignment.departmentId === departmentId &&
          assignment.assignmentRole === 'responsible'
      )
      .forEach((assignment) => {
        batch.update(assignmentDocRef(congregationId, assignment.id), {
          isActive: false,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.uid,
        });
      });
  }

  const ref = doc(assignmentsRef(congregationId));
  batch.set(ref, {
    departmentId,
    userId,
    assignmentRole: role,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: currentUser.uid,
    updatedBy: currentUser.uid,
  });
  await batch.commit();
};

export const assignDepartmentResponsible = (
  congregationId: string,
  departmentId: string,
  userId: string,
  currentUser: AppUser
) => assignDepartmentRole(congregationId, departmentId, userId, 'responsible', currentUser);

export const addDepartmentAssistant = (
  congregationId: string,
  departmentId: string,
  userId: string,
  currentUser: AppUser
) => assignDepartmentRole(congregationId, departmentId, userId, 'assistant', currentUser);

export const removeDepartmentAssignment = async (
  congregationId: string,
  assignmentId: string,
  currentUser: AppUser
): Promise<void> => {
  assertCanManage(congregationId, currentUser);
  const batch = writeBatch(db);
  batch.update(assignmentDocRef(congregationId, assignmentId), {
    isActive: false,
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid,
  });
  await batch.commit();
};

export const updateDepartmentAssignmentRole = async (
  congregationId: string,
  assignmentId: string,
  role: DepartmentAssignmentRole,
  currentUser: AppUser
): Promise<void> => {
  assertCanManage(congregationId, currentUser);
  const assignments = await getActiveDepartmentAssignments(congregationId);
  const target = assignments.find((assignment) => assignment.id === assignmentId);
  if (!target) throw new Error('Asignacion no encontrada.');

  const batch = writeBatch(db);
  if (role === 'responsible') {
    assignments
      .filter(
        (assignment) =>
          assignment.departmentId === target.departmentId &&
          assignment.assignmentRole === 'responsible' &&
          assignment.id !== assignmentId
      )
      .forEach((assignment) => {
        batch.update(assignmentDocRef(congregationId, assignment.id), {
          isActive: false,
          updatedAt: serverTimestamp(),
          updatedBy: currentUser.uid,
        });
      });
  }

  batch.update(assignmentDocRef(congregationId, assignmentId), {
    assignmentRole: role,
    updatedAt: serverTimestamp(),
    updatedBy: currentUser.uid,
  });
  await batch.commit();
};

export const reorderDepartments = async (
  congregationId: string,
  orderedDepartments: Department[],
  currentUser: AppUser
): Promise<void> => {
  assertCanManage(congregationId, currentUser);
  const batch = writeBatch(db);
  orderedDepartments.forEach((department, index) => {
    batch.update(departmentDocRef(congregationId, department.id), {
      order: (index + 1) * 10,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid,
    });
  });
  await batch.commit();
};

export const buildOrgChart = (
  departments: Department[],
  assignments: DepartmentAssignment[],
  users: AppUser[]
): OrgChartCategoryGroup => {
  const groups = DEPARTMENT_CATEGORIES.reduce<OrgChartCategoryGroup>((acc, category) => {
    acc[category] = [];
    return acc;
  }, {} as OrgChartCategoryGroup);

  const activeDepartments = departments
    .filter((department) => department.isActive)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es'));
  const departmentIds = new Set(activeDepartments.map((department) => department.id));
  const usersById = new Map(
    users
      .filter((user) => user.isActive)
      .map((user) => [user.uid, user])
  );

  activeDepartments.forEach((department) => {
    const departmentAssignments = assignments.filter(
      (assignment) =>
        assignment.isActive &&
        assignment.departmentId === department.id &&
        departmentIds.has(assignment.departmentId)
    );
    const responsibleAssignment = departmentAssignments.find(
      (assignment) => assignment.assignmentRole === 'responsible' && usersById.has(assignment.userId)
    );
    const assistants = departmentAssignments
      .filter((assignment) => assignment.assignmentRole === 'assistant')
      .map((assignment) => usersById.get(assignment.userId))
      .filter((user): user is AppUser => Boolean(user))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));

    groups[department.category].push({
      department,
      responsible: responsibleAssignment ? usersById.get(responsibleAssignment.userId) ?? null : null,
      assistants,
    });
  });

  return groups;
};
