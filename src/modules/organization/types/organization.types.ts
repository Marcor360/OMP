import type { Timestamp } from 'firebase/firestore';

export type OrganizationPosition =
  | 'coordinador'
  | 'secretario'
  | 'encargado'
  | 'auxiliar'
  | 'apoyo';

export type OrganizationDepartment =
  | 'coordinacion'
  | 'secretaria'
  | 'predicacion'
  | 'territorios'
  | 'reuniones'
  | 'asignaciones'
  | 'limpieza'
  | 'hospitalidad'
  | 'discursos'
  | 'tesoreria'
  | 'usuarios'
  | 'configuracion';

export type OrganizationTreeNodeType = 'person' | 'department';

export interface Department {
  id: string;
  congregationId: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  order: number;
  isActive: boolean;
  allowMultipleManagers: boolean;
  allowMultipleAssistants: boolean;
  createdAt?: Timestamp | unknown;
  updatedAt?: Timestamp | unknown;
}

export interface DepartmentAssignment {
  id: string;
  congregationId: string;
  departmentId: string;
  departmentName: string;
  userId: string;
  displayName: string;
  email?: string;
  position: OrganizationPosition;
  title: string;
  parentAssignmentId?: string | null;
  level: number;
  order: number;
  isActive: boolean;
  createdAt?: Timestamp | unknown;
  updatedAt?: Timestamp | unknown;
  createdBy?: string;
  updatedBy?: string;
}

export interface OrganizationTreeNode {
  id: string;
  type: OrganizationTreeNodeType;
  assignmentId?: string;
  userId?: string;
  displayName: string;
  title: string;
  departmentId?: string;
  departmentName?: string;
  position?: OrganizationPosition;
  level: number;
  order: number;
  parentId?: string | null;
  children: OrganizationTreeNode[];
}

export type BuildOrganizationTreeInput = {
  departments: Department[];
  assignments: DepartmentAssignment[];
};

export type BuildOrganizationTreeResult = {
  roots: OrganizationTreeNode[];
  warnings: string[];
  isComplete: boolean;
};

export type OrganizationLayoutMode = 'desktop' | 'tablet' | 'mobile';

export const ORGANIZATION_POSITION_LABELS: Record<OrganizationPosition, string> = {
  coordinador: 'Coordinador',
  secretario: 'Secretario',
  encargado: 'Encargado',
  auxiliar: 'Auxiliar',
  apoyo: 'Apoyo',
};

export const OPERATIONAL_DEPARTMENT_IDS: OrganizationDepartment[] = [
  'predicacion',
  'territorios',
  'reuniones',
  'asignaciones',
  'limpieza',
  'hospitalidad',
  'discursos',
  'tesoreria',
];

export const DEFAULT_DEPARTMENTS: Pick<
  Department,
  'id' | 'name' | 'order' | 'allowMultipleManagers' | 'allowMultipleAssistants'
>[] = [
  {
    id: 'coordinacion',
    name: 'Coordinacion',
    order: 1,
    allowMultipleManagers: false,
    allowMultipleAssistants: false,
  },
  {
    id: 'secretaria',
    name: 'Secretaria',
    order: 2,
    allowMultipleManagers: false,
    allowMultipleAssistants: true,
  },
  {
    id: 'predicacion',
    name: 'Predicacion',
    order: 3,
    allowMultipleManagers: false,
    allowMultipleAssistants: true,
  },
  {
    id: 'territorios',
    name: 'Territorios',
    order: 4,
    allowMultipleManagers: false,
    allowMultipleAssistants: true,
  },
  {
    id: 'reuniones',
    name: 'Reuniones',
    order: 5,
    allowMultipleManagers: false,
    allowMultipleAssistants: true,
  },
  {
    id: 'asignaciones',
    name: 'Asignaciones',
    order: 6,
    allowMultipleManagers: false,
    allowMultipleAssistants: true,
  },
  {
    id: 'limpieza',
    name: 'Limpieza',
    order: 7,
    allowMultipleManagers: false,
    allowMultipleAssistants: true,
  },
  {
    id: 'hospitalidad',
    name: 'Hospitalidad',
    order: 8,
    allowMultipleManagers: false,
    allowMultipleAssistants: true,
  },
  {
    id: 'discursos',
    name: 'Discursos',
    order: 9,
    allowMultipleManagers: false,
    allowMultipleAssistants: true,
  },
  {
    id: 'tesoreria',
    name: 'Tesoreria',
    order: 10,
    allowMultipleManagers: false,
    allowMultipleAssistants: true,
  },
];
