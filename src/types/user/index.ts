import { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'supervisor' | 'user';
export type UserStatus = 'active' | 'inactive' | 'suspended';

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
  avatarUrl?: string;
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
}

export interface UpdateUserDTO {
  displayName?: string;
  role?: UserRole;
  status?: UserStatus;
  isActive?: boolean;
  congregationId?: string;
  phone?: string;
  department?: string;
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