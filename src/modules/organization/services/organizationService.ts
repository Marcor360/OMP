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
import { httpsCallable } from 'firebase/functions';

import { db, functions } from '@/src/lib/firebase/app';
import {
  DEFAULT_DEPARTMENTS,
  type Department,
  type DepartmentAssignment,
  type OrganizationPosition,
} from '@/src/modules/organization/types/organization.types';

type DepartmentPayload = Omit<Department, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

const departmentsCollectionRef = (congregationId: string) =>
  collection(db, 'congregations', congregationId, 'departments');

const departmentDocRef = (congregationId: string, departmentId: string) =>
  doc(db, 'congregations', congregationId, 'departments', departmentId);

const assignmentsCollectionRef = (congregationId: string) =>
  collection(db, 'congregations', congregationId, 'departmentAssignments');

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

export type RegenerateOrgChartResult = {
  ok: boolean;
  created: number;
  updated: number;
  deactivated: number;
  departmentsCreated: number;
  warnings: string[];
};

export const regenerateOrgChart = async (): Promise<RegenerateOrgChartResult> => {
  const callable = httpsCallable<Record<string, never>, RegenerateOrgChartResult>(
    functions,
    'regenerateOrgChart'
  );
  const response = await callable({});
  return response.data;
};
