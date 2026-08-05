import { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'supervisor' | 'user';
export type UserStatus = 'active' | 'inactive' | 'suspended';
export type UserGender = 'masculino' | 'femenino';
export type UserServicePosition = 'coordinador' | 'secretario' | 'encargado' | 'auxiliar' | 'apoyo';
export type UserServiceDepartment =
  | 'coordinacion'
  | 'secretaria'
  | 'limpieza'
  | 'literatura'
  | 'tesoreria'
  | 'mantenimiento'
  | 'discursos'
  | 'reuniones'
  | 'predicacion'
  | 'territorios'
  | 'asignaciones'
  | 'hospitalidad'
  | 'usuarios'
  | 'configuracion'
  | 'audio_video'
  | 'acomodadores_microfonos';

export const USER_SERVICE_POSITION_LABELS: Record<UserServicePosition, string> = {
  coordinador: 'Coordinador',
  secretario: 'Secretario',
  encargado: 'Encargado',
  auxiliar: 'Auxiliar',
  apoyo: 'Apoyo',
};

export const USER_SERVICE_DEPARTMENT_LABELS: Record<UserServiceDepartment, string> = {
  coordinacion: 'Coordinacion',
  secretaria: 'Secretaria',
  limpieza: 'Limpieza',
  literatura: 'Literatura',
  tesoreria: 'Tesoreria',
  mantenimiento: 'Mantenimiento',
  discursos: 'Discursos',
  reuniones: 'Reuniones',
  predicacion: 'Predicacion',
  territorios: 'Predicacion',
  asignaciones: 'Asignaciones',
  hospitalidad: 'Hospitalidad',
  usuarios: 'Usuarios',
  configuracion: 'Configuracion',
  audio_video: 'Audio y Video',
  acomodadores_microfonos: 'Acomodadores y Microfonos',
};

export const USER_SERVICE_DEPARTMENTS: UserServiceDepartment[] = [
  'limpieza',
  'literatura',
  'tesoreria',
  'mantenimiento',
  'discursos',
  'reuniones',
  'predicacion',
  'asignaciones',
  'hospitalidad',
  'usuarios',
  'configuracion',
  'audio_video',
  'acomodadores_microfonos',
];

export interface UserPrivileges {
  isElder?: boolean;
  isMinisterialServant?: boolean;
  isRegularPioneer?: boolean;
  isAuxiliaryPioneer?: boolean;
}

export interface UserResponsibilities {
  isPreachingManager?: boolean;
}

export type PermissionDepartment =
  | 'usuarios'
  | 'reuniones'
  | 'limpieza'
  | 'departments'
  | 'predicacion'
  | 'tesoreria'
  | 'pagos'
  | 'configuracion'
  | 'avisos'
  | 'asignaciones'
  | 'acomodadores_microfonos'
  | 'organigrama';

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'manage'
  | 'approve'
  | 'export';

export type TerritoryPermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'assign' | 'manage';

export type DepartmentPermissions = Partial<Record<PermissionAction, boolean>> & {
  territories?: Partial<Record<TerritoryPermissionAction, boolean>>;
};
export type UserPermissions = Partial<Record<PermissionDepartment, DepartmentPermissions>>;

export interface UserServiceAssignment {
  position: UserServicePosition;
  department?: UserServiceDepartment;
  label: string;
}

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  congregationId: string;
  isActive: boolean;
  status: UserStatus;
  phone?: string;
  gender?: UserGender;
  department?: string;
  servicePosition?: UserServicePosition;
  serviceDepartment?: UserServiceDepartment;
  serviceAssignments?: UserServiceAssignment[];
  privileges?: UserPrivileges;
  responsibilities?: UserResponsibilities;
  permissions?: UserPermissions;
  isElder: boolean;
  isMinisterialServant: boolean;
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
  eventsNotifications?: boolean;
  createdBy?: string;
  createdByName?: string;
  createdByEmail?: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedByEmail?: string;
  protectedFromDeletion?: boolean;
  isSystemUser?: boolean;
  isPrimaryAdmin?: boolean;
  isRootAdmin?: boolean;
  systemProtected?: boolean;
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
  gender?: UserGender;
  department?: string;
  servicePosition?: UserServicePosition;
  serviceDepartment?: UserServiceDepartment;
  serviceAssignments?: UserServiceAssignment[];
  privileges?: UserPrivileges;
  responsibilities?: UserResponsibilities;
  permissions?: UserPermissions;
  isElder?: boolean;
  isMinisterialServant?: boolean;
  createdBy?: string;
  createdByName?: string;
  createdByEmail?: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedByEmail?: string;
  secondLastName?: string;
}

export interface UpdateUserDTO {
  displayName?: string;
  role?: UserRole;
  status?: UserStatus;
  isActive?: boolean;
  congregationId?: string;
  phone?: string;
  gender?: UserGender;
  department?: string;
  servicePosition?: UserServicePosition;
  serviceDepartment?: UserServiceDepartment;
  serviceAssignments?: UserServiceAssignment[];
  privileges?: UserPrivileges;
  responsibilities?: UserResponsibilities;
  permissions?: UserPermissions;
  isElder?: boolean;
  isMinisterialServant?: boolean;
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
  eventsNotifications?: boolean;
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

export const PRIVILEGE_LABELS: Record<keyof UserPrivileges, string> = {
  isElder: 'Anciano',
  isMinisterialServant: 'Siervo Ministerial',
  isRegularPioneer: 'Precursor Regular',
  isAuxiliaryPioneer: 'Precursor Auxiliar',
};

export const RESPONSIBILITY_LABELS: Record<keyof UserResponsibilities, string> = {
  isPreachingManager: 'Encargado de predicacion',
};

export const isPioneer = (user: Pick<AppUser, 'privileges'> | null | undefined): boolean =>
  Boolean(user?.privileges?.isRegularPioneer || user?.privileges?.isAuxiliaryPioneer);

export const getPioneerType = (
  user: Pick<AppUser, 'privileges'> | null | undefined
): 'regular' | 'auxiliary' | null => {
  if (user?.privileges?.isRegularPioneer) return 'regular';
  if (user?.privileges?.isAuxiliaryPioneer) return 'auxiliary';
  return null;
};

export const isPreachingManager = (
  user:
    | Pick<AppUser, 'privileges' | 'servicePosition' | 'serviceDepartment' | 'serviceAssignments'>
    | null
    | undefined
): boolean =>
  Boolean(
    (
      (user?.serviceDepartment === 'predicacion' || user?.serviceDepartment === 'territorios') &&
        (
          (user.servicePosition === 'encargado' && user.privileges?.isElder === true) ||
          user.servicePosition === 'auxiliar'
        )
    ) ||
      user?.serviceAssignments?.some(
        (assignment) =>
          (assignment.department === 'predicacion' || assignment.department === 'territorios') &&
          (
            (assignment.position === 'encargado' && user.privileges?.isElder === true) ||
            assignment.position === 'auxiliar'
          )
      )
  );
