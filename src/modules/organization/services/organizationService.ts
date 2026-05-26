import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';

import { db } from '@/src/lib/firebase/app';
import { userDocRef } from '@/src/lib/firebase/refs';
import {
  DEFAULT_DEPARTMENTS,
  type Department,
  type DepartmentAssignment,
  type OrganizationPosition,
} from '@/src/modules/organization/types/organization.types';
import { validateDepartmentAssignment } from '@/src/modules/organization/utils/organizationValidation';
import { getAllUsers, getUserById } from '@/src/services/users/users-service';
import type { AppUser, UserServiceAssignment, UserServiceDepartment } from '@/src/types/user';

type DepartmentPayload = Omit<Department, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
type AssignmentPayload = Omit<DepartmentAssignment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

const departmentsCollectionRef = (congregationId: string) =>
  collection(db, 'congregations', congregationId, 'departments');

const departmentDocRef = (congregationId: string, departmentId: string) =>
  doc(db, 'congregations', congregationId, 'departments', departmentId);

const assignmentsCollectionRef = (congregationId: string) =>
  collection(db, 'congregations', congregationId, 'departmentAssignments');

const assignmentDocRef = (congregationId: string, assignmentId: string) =>
  doc(db, 'congregations', congregationId, 'departmentAssignments', assignmentId);

const normalizeDepartment = (id: string, data: DocumentData): Department => ({
  id,
  congregationId: typeof data.congregationId === 'string' ? data.congregationId : '',
  name: typeof data.name === 'string' ? data.name : 'Departamento',
  description: typeof data.description === 'string' ? data.description : undefined,
  icon: typeof data.icon === 'string' ? data.icon : undefined,
  color: typeof data.color === 'string' ? data.color : undefined,
  order: typeof data.order === 'number' ? data.order : 0,
  isActive: data.isActive !== false,
  allowMultipleManagers: data.allowMultipleManagers === true,
  allowMultipleAssistants: data.allowMultipleAssistants !== false,
  createdAt: data.createdAt,
  updatedAt: data.updatedAt,
});

const normalizeAssignment = (id: string, data: DocumentData): DepartmentAssignment => ({
  id,
  congregationId: typeof data.congregationId === 'string' ? data.congregationId : '',
  departmentId: typeof data.departmentId === 'string' ? data.departmentId : '',
  departmentName: typeof data.departmentName === 'string' ? data.departmentName : '',
  userId: typeof data.userId === 'string' ? data.userId : '',
  displayName: typeof data.displayName === 'string' ? data.displayName : '',
  email: typeof data.email === 'string' ? data.email : undefined,
  position: data.position as OrganizationPosition,
  title: typeof data.title === 'string' ? data.title : '',
  parentAssignmentId:
    typeof data.parentAssignmentId === 'string' ? data.parentAssignmentId : null,
  level: typeof data.level === 'number' ? data.level : 0,
  order: typeof data.order === 'number' ? data.order : 0,
  isActive: data.isActive === true,
  createdAt: data.createdAt,
  updatedAt: data.updatedAt,
  createdBy: typeof data.createdBy === 'string' ? data.createdBy : undefined,
  updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
});

const assignmentToUserServiceAssignment = (
  assignment: Pick<DepartmentAssignment, 'departmentId' | 'position' | 'title'>
): UserServiceAssignment => ({
  department: assignment.departmentId as UserServiceDepartment,
  position: assignment.position,
  label: assignment.title,
});

const loadValidationContext = async (congregationId: string) => {
  const [departments, assignments, users] = await Promise.all([
    getDepartments(congregationId),
    getDepartmentAssignments(congregationId),
    getAllUsers(congregationId, { forceServer: true }),
  ]);

  return { departments, assignments, users };
};

export const getDepartments = async (congregationId: string): Promise<Department[]> => {
  const snapshot = await getDocs(query(departmentsCollectionRef(congregationId), orderBy('order', 'asc')));
  return snapshot.docs
    .map((item) => normalizeDepartment(item.id, item.data()))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es'));
};

export const getDepartmentAssignments = async (
  congregationId: string
): Promise<DepartmentAssignment[]> => {
  const snapshot = await getDocs(query(assignmentsCollectionRef(congregationId), orderBy('order', 'asc')));
  return snapshot.docs.map((item) => normalizeAssignment(item.id, item.data()));
};

export const getActiveOrganizationUsers = async (congregationId: string): Promise<AppUser[]> =>
  getAllUsers(congregationId, { forceServer: true }).then((users) =>
    users
      .filter((user) => user.isActive === true && user.congregationId === congregationId)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'))
  );

export const seedDefaultDepartments = async (congregationId: string): Promise<void> => {
  const existing = await getDocs(query(departmentsCollectionRef(congregationId)));
  const existingIds = new Set(existing.docs.map((item) => item.id));
  const batch = writeBatch(db);

  DEFAULT_DEPARTMENTS.forEach((department) => {
    if (existingIds.has(department.id)) return;
    batch.set(departmentDocRef(congregationId, department.id), {
      ...department,
      congregationId,
      isActive: true,
      description: '',
      icon: '',
      color: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
};

export const createDepartment = async (data: DepartmentPayload): Promise<void> => {
  const id = data.id?.trim() || data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  await setDoc(departmentDocRef(data.congregationId, id), {
    ...data,
    id,
    congregationId: data.congregationId,
    name: data.name.trim(),
    description: data.description?.trim() ?? '',
    order: Number(data.order) || 0,
    isActive: data.isActive !== false,
    allowMultipleManagers: data.allowMultipleManagers === true,
    allowMultipleAssistants: data.allowMultipleAssistants !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const updateDepartment = async (
  congregationId: string,
  departmentId: string,
  data: Partial<DepartmentPayload>
): Promise<void> => {
  await updateDoc(departmentDocRef(congregationId, departmentId), {
    ...data,
    congregationId,
    updatedAt: serverTimestamp(),
  });
};

export const syncUserServiceAssignment = async (
  congregationId: string,
  userId: string,
  assignment: Pick<DepartmentAssignment, 'departmentId' | 'position' | 'title'>
): Promise<void> => {
  const user = await getUserById(userId, { forceServer: true });
  if (!user || user.congregationId !== congregationId || user.isActive !== true) {
    throw new Error('El usuario seleccionado no es elegible.');
  }

  const serviceAssignment = assignmentToUserServiceAssignment(assignment);
  const nextAssignments = [
    ...(user.serviceAssignments ?? []).filter(
      (item) =>
        !(
          item.department === serviceAssignment.department &&
          item.position === serviceAssignment.position
        )
    ),
    serviceAssignment,
  ];
  const primary = nextAssignments[0];

  await updateDoc(userDocRef(userId), {
    serviceAssignments: nextAssignments,
    servicePosition: primary?.position ?? null,
    serviceDepartment: primary?.department ?? null,
    department: primary?.label ?? null,
    updatedAt: serverTimestamp(),
  });
};

export const removeUserServiceAssignment = async (
  congregationId: string,
  userId: string,
  assignment: Pick<DepartmentAssignment, 'departmentId' | 'position'>
): Promise<void> => {
  const user = await getUserById(userId, { forceServer: true });
  if (!user || user.congregationId !== congregationId) return;

  const nextAssignments = (user.serviceAssignments ?? []).filter(
    (item) =>
      !(
        item.department === assignment.departmentId &&
        item.position === assignment.position
      )
  );
  const primary = nextAssignments[0];

  await updateDoc(userDocRef(userId), {
    serviceAssignments: nextAssignments,
    servicePosition: primary?.position ?? null,
    serviceDepartment: primary?.department ?? null,
    department: primary?.label ?? null,
    updatedAt: serverTimestamp(),
  });
};

export const createDepartmentAssignment = async (
  data: AssignmentPayload
): Promise<void> => {
  const { departments, assignments, users } = await loadValidationContext(data.congregationId);
  validateDepartmentAssignment({ assignment: data, departments, assignments, users });
  const ref = data.id ? assignmentDocRef(data.congregationId, data.id) : doc(assignmentsCollectionRef(data.congregationId));

  await setDoc(ref, {
    ...data,
    id: ref.id,
    title: data.title.trim(),
    displayName: data.displayName.trim(),
    isActive: data.isActive,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await syncUserServiceAssignment(data.congregationId, data.userId, data);
};

export const updateDepartmentAssignment = async (
  congregationId: string,
  assignmentId: string,
  data: Partial<AssignmentPayload>
): Promise<void> => {
  const existing = (await getDepartmentAssignments(congregationId)).find((item) => item.id === assignmentId);
  if (!existing) throw new Error('Asignacion no encontrada.');
  const next = { ...existing, ...data, id: assignmentId, congregationId };
  const { departments, assignments, users } = await loadValidationContext(congregationId);
  validateDepartmentAssignment({ assignment: next, departments, assignments, users });

  await updateDoc(assignmentDocRef(congregationId, assignmentId), {
    ...data,
    congregationId,
    updatedAt: serverTimestamp(),
  });
  await syncUserServiceAssignment(congregationId, next.userId, next);
};

export const deactivateDepartmentAssignment = async (
  congregationId: string,
  assignmentId: string
): Promise<void> => {
  const existing = (await getDepartmentAssignments(congregationId)).find((item) => item.id === assignmentId);
  if (!existing) throw new Error('Asignacion no encontrada.');

  await updateDoc(assignmentDocRef(congregationId, assignmentId), {
    isActive: false,
    updatedAt: serverTimestamp(),
  });
  await removeUserServiceAssignment(congregationId, existing.userId, existing);
};
