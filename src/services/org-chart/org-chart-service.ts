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
import {
  USER_SERVICE_DEPARTMENT_LABELS,
  USER_SERVICE_DEPARTMENTS,
  type AppUser,
  type UserServiceDepartment,
  type UserServicePosition,
} from '@/src/types/user';
import {
  canManageDepartments,
} from '@/src/utils/permissions/permissions';
import { normalizeUser } from '@/src/services/users/users-service';

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

const AUTO_DEPARTMENT_CATEGORY: Record<UserServiceDepartment, DepartmentCategory> = {
  coordinacion: 'administration',
  secretaria: 'administration',
  limpieza: 'operations',
  literatura: 'operations',
  tesoreria: 'administration',
  mantenimiento: 'operations',
  discursos: 'meetings',
  reuniones: 'meetings',
  predicacion: 'service',
  territorios: 'service',
  asignaciones: 'meetings',
  hospitalidad: 'operations',
  usuarios: 'administration',
  configuracion: 'administration',
  audio_video: 'operations',
  acomodadores_microfonos: 'operations',
};

const AUTO_DEPARTMENTS: Department[] = [
  {
    id: 'auto:coordinador',
    name: 'Coordinador',
    category: 'administration',
    parentId: null,
    order: 10,
    isActive: true,
  },
  {
    id: 'auto:secretario',
    name: 'Secretario',
    category: 'administration',
    parentId: null,
    order: 20,
    isActive: true,
  },
  ...USER_SERVICE_DEPARTMENTS.map((department, index): Department => ({
    id: `auto:${department}`,
    name: USER_SERVICE_DEPARTMENT_LABELS[department],
    category: AUTO_DEPARTMENT_CATEGORY[department],
    parentId: null,
    order: 100 + (index + 1) * 10,
    isActive: true,
  })),
];

const normalizeLabelKey = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const autoDepartmentKeyForAssignment = (
  position?: UserServicePosition,
  department?: UserServiceDepartment
): string | null => {
  if (position === 'coordinador') return 'auto:coordinador';
  if (position === 'secretario') return 'auto:secretario';
  if ((position === 'encargado' || position === 'auxiliar' || position === 'apoyo') && department) {
    return `auto:${department}`;
  }
  return null;
};

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

type OrgChartUsersResult = {
  users?: (Record<string, unknown> & { uid?: string })[];
};

export const getOrgChartUsersForCurrentCongregation = async (
  congregationId: string
): Promise<AppUser[]> => {
  const callable = httpsCallable<Record<string, never>, OrgChartUsersResult>(
    functions,
    'listOrgChartUsersForCurrentCongregation'
  );
  const result = await callable({});
  const users = Array.isArray(result.data?.users) ? result.data.users : [];

  return users
    .map((user) => normalizeUser(typeof user.uid === 'string' ? user.uid : '', user))
    .filter((user) => user.uid.length > 0)
    .filter((user) => user.isActive === true && user.congregationId === congregationId)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));
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
  const [departments, users] = await Promise.all([
    getActiveDepartments(congregationId),
    getOrgChartUsersForCurrentCongregation(congregationId),
  ]);
  const department = departments.find((item) => item.id === departmentId);
  if (!department) throw new Error('Departamento no encontrado o inactivo.');

  const userDoc = users.find((item) => item.uid === userId);
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

  const autoDepartmentNameKeys = new Set(AUTO_DEPARTMENTS.map((department) => normalizeLabelKey(department.name)));
  const customDepartments = departments
    .filter((department) => department.isActive && !autoDepartmentNameKeys.has(normalizeLabelKey(department.name)));
  const activeDepartments = [...AUTO_DEPARTMENTS, ...customDepartments]
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es'));
  const departmentIds = new Set(activeDepartments.map((department) => department.id));
  const usersById = new Map(
    users
      .filter((user) => user.isActive)
      .map((user) => [user.uid, user])
  );

  activeDepartments.forEach((department) => {
    if (department.id.startsWith('auto:')) {
      const responsible = users
        .filter((user) => user.isActive)
        .find((user) =>
          user.serviceAssignments?.some((assignment) => {
            const departmentId = autoDepartmentKeyForAssignment(assignment.position, assignment.department);
            if (departmentId !== department.id) return false;
            return (
              assignment.position === 'coordinador' ||
              assignment.position === 'secretario' ||
              assignment.position === 'encargado'
            );
          })
        ) ?? null;

      const assistants = users
        .filter((user) => user.isActive)
        .filter((user) =>
          user.serviceAssignments?.some(
            (assignment) =>
              assignment.position === 'auxiliar' &&
              autoDepartmentKeyForAssignment(assignment.position, assignment.department) === department.id
          )
        )
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));

      groups[department.category].push({
        department,
        responsible,
        assistants,
      });
      return;
    }

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
