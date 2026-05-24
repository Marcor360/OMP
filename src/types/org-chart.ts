import type { Timestamp } from 'firebase/firestore';

import type { AppUser } from '@/src/types/user';

export type DepartmentCategory =
  | 'administration'
  | 'service'
  | 'meetings'
  | 'operations'
  | 'groups'
  | 'other';

export type DepartmentAssignmentRole = 'responsible' | 'assistant';

export interface Department {
  id: string;
  name: string;
  category: DepartmentCategory;
  parentId: string | null;
  order: number;
  isActive: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  createdBy?: string;
  updatedBy?: string;
}

export interface DepartmentAssignment {
  id: string;
  departmentId: string;
  userId: string;
  assignmentRole: DepartmentAssignmentRole;
  isActive: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  createdBy?: string;
  updatedBy?: string;
}

export interface OrgChartNode {
  department: Department;
  responsible: AppUser | null;
  assistants: AppUser[];
}

export type OrgChartCategoryGroup = Record<DepartmentCategory, OrgChartNode[]>;

export type DepartmentPayload = {
  name: string;
  category: DepartmentCategory;
  parentId?: string | null;
  order?: number;
};

export const DEPARTMENT_CATEGORIES: DepartmentCategory[] = [
  'administration',
  'service',
  'meetings',
  'operations',
  'groups',
  'other',
];

export const DEPARTMENT_CATEGORY_LABELS: Record<DepartmentCategory, string> = {
  administration: 'Administracion',
  service: 'Servicio',
  meetings: 'Reuniones',
  operations: 'Operaciones',
  groups: 'Grupos',
  other: 'Otros',
};

export const INITIAL_DEPARTMENT_TEMPLATE: DepartmentPayload[] = [
  { name: 'Secretario', category: 'administration', order: 10 },
  { name: 'Coordinador del cuerpo de ancianos', category: 'administration', order: 20 },
  { name: 'Contabilidad', category: 'administration', order: 30 },
  { name: 'Superintendente de servicio', category: 'service', order: 10 },
  { name: 'Territorios', category: 'service', order: 20 },
  { name: 'Grupo de servicio #1', category: 'service', order: 30 },
  { name: 'Grupo de servicio #2', category: 'service', order: 40 },
  { name: 'Grupo de servicio #3', category: 'service', order: 50 },
  { name: 'Coordinador de discursos publicos', category: 'meetings', order: 10 },
  { name: 'Reunion vida y ministerio', category: 'meetings', order: 20 },
  { name: 'Conductor de La Atalaya', category: 'meetings', order: 30 },
  { name: 'Consejero auxiliar', category: 'meetings', order: 40 },
  { name: 'Limpieza', category: 'operations', order: 10 },
  { name: 'Literatura', category: 'operations', order: 20 },
  { name: 'Exhibidores', category: 'operations', order: 30 },
  { name: 'Audio y video', category: 'operations', order: 40 },
  { name: 'Mantenimiento', category: 'operations', order: 50 },
  { name: 'Acomodadores', category: 'operations', order: 60 },
];
