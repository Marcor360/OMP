import { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'supervisor' | 'user';
export type UserStatus = 'active' | 'inactive' | 'suspended';
export type UserServicePosition = 'coordinador' | 'secretario' | 'encargado' | 'auxiliar';
export type UserServiceDepartment =
  | 'limpieza'
  | 'literatura'
  | 'tesoreria'
  | 'mantenimiento'
  | 'discursos'
  | 'predicacion'
  | 'acomodadores_microfonos';

export const USER_SERVICE_POSITION_LABELS: Record<UserServicePosition, string> = {
  coordinador: 'Coordinador',
  secretario: 'Secretario',
  encargado: 'Encargado',
  auxiliar: 'Auxiliar',
};

export const USER_SERVICE_DEPARTMENT_LABELS: Record<UserServiceDepartment, string> = {
  limpieza: 'Limpieza',
  literatura: 'Literatura',
  tesoreria: 'Tesoreria',
  mantenimiento: 'Mantenimiento',
  discursos: 'Discursos',
  predicacion: 'Predicacion',
  acomodadores_microfonos: 'Acomodadores y Microfonos',
};

export const USER_SERVICE_DEPARTMENTS: UserServiceDepartment[] = [
  'limpieza',
  'literatura',
  'tesoreria',
  'mantenimiento',
  'discursos',
  'predicacion',
  'acomodadores_microfonos',
];

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  congregationId: string;
  isActive: boolean;
  status: UserStatus;
  phone?: string;
  department?: string;
  servicePosition?: UserServicePosition;
  serviceDepartment?: UserServiceDepartment;
  avatarUrl?: string;
  secondLastName?: string;
  // Campos de modulo de limpieza
  cleaningEligible?: boolean;
  cleaningGroupId?: string | null;
  cleaningGroupName?: string | null;
  // Campos de notificaciones
  notificationTokens?: string[];
  notificationsEnabled?: boolean;
  platformNotifications?: boolean;
  cleaningNotifications?: boolean;
  hospitalityNotifications?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CreateUserDTO {
  email: string;
  password?: string;
  displayName: string;
  role: UserRole;
  congregationId: string;
  isActive?: boolean;
  phone?: string;
  department?: string;
  servicePosition?: UserServicePosition;
  serviceDepartment?: UserServiceDepartment;
  secondLastName?: string;
}

export interface UpdateUserDTO {
  displayName?: string;
  role?: UserRole;
  status?: UserStatus;
  isActive?: boolean;
  congregationId?: string;
  phone?: string;
  department?: string;
  servicePosition?: UserServicePosition;
  serviceDepartment?: UserServiceDepartment;
  // Campos de modulo de limpieza
  cleaningEligible?: boolean;
  cleaningGroupId?: string | null;
  cleaningGroupName?: string | null;
  // Campos de notificaciones
  notificationTokens?: string[];
  notificationsEnabled?: boolean;
  platformNotifications?: boolean;
  cleaningNotifications?: boolean;
  hospitalityNotifications?: boolean;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  user: 'Usuario',
};

export const STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  suspended: 'Suspendido',
};
