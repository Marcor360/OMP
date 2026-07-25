export type Role = 'admin' | 'supervisor' | 'user';
export type Gender = 'masculino' | 'femenino';
export type ServicePosition = 'coordinador' | 'secretario' | 'encargado' | 'auxiliar';
export type ServiceDepartment =
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

export type UserPrivileges = {
  isElder?: boolean;
  isMinisterialServant?: boolean;
  isRegularPioneer?: boolean;
  isAuxiliaryPioneer?: boolean;
};

export type UserResponsibilities = {
  isPreachingManager?: boolean;
};

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
  | 'organigrama'
  | 'acomodadores_microfonos';

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
  manageTerritories?: boolean;
};

export type UserPermissions = Partial<Record<PermissionDepartment, DepartmentPermissions>>;

export type ServiceAssignment = {
  position?: ServicePosition;
  department?: ServiceDepartment;
  label?: string;
};

export type StoredServiceAssignment = {
  position: ServicePosition;
  department?: ServiceDepartment;
  label: string;
};

export type RequesterProfile = {
  role: Role;
  isActive: boolean;
  congregationId: string;
  displayName?: string;
  email?: string;
  servicePosition?: ServicePosition;
  protectedFromDeletion?: boolean;
  isSystemUser?: boolean;
  isPrimaryAdmin?: boolean;
  isRootAdmin?: boolean;
  systemProtected?: boolean;
  permissions?: UserPermissions;
};

export type ListUsersPayload = {
  activeOnly?: boolean;
};

export type ListUsersResult = {
  users: (Record<string, unknown> & { uid: string })[];
};

export type ListUsersPagePayload = {
  activeOnly?: boolean;
  cursor?: string;
  pageSize?: number;
  includeTotal?: boolean;
};

export type ListUsersPageResult = {
  users: (Record<string, unknown> & { uid: string })[];
  cursor: string | null;
  hasMore: boolean;
  total: number | null;
};

export type CreateUserPayload = {
  firstName: string;
  middleName?: string;
  lastName: string;
  secondLastName?: string;
  displayName: string;
  role: Role;
  congregationId: string;
  isActive: boolean;
  phone?: string;
  gender?: Gender;
  password: string;
  servicePosition?: ServicePosition;
  serviceDepartment?: ServiceDepartment;
  departmentLabel?: string;
  serviceAssignments: StoredServiceAssignment[];
  privileges?: UserPrivileges;
  responsibilities?: UserResponsibilities;
  permissions?: UserPermissions;
};

export type UpdateUserPayload = {
  uid: string;
  displayName?: string;
  role?: Role;
  isActive?: boolean;
  phone?: string;
  phoneProvided: boolean;
  gender?: Gender;
  genderProvided: boolean;
  servicePosition?: ServicePosition;
  serviceDepartment?: ServiceDepartment;
  servicePositionProvided: boolean;
  serviceDepartmentProvided: boolean;
  serviceAssignmentProvided: boolean;
  serviceAssignmentsRaw?: unknown;
  serviceAssignmentsProvided: boolean;
  privileges?: UserPrivileges;
  responsibilities?: UserResponsibilities;
  permissions?: UserPermissions;
  privilegesProvided: boolean;
  responsibilitiesProvided: boolean;
  permissionsProvided: boolean;
};

export type UpdatePasswordPayload = {
  uid: string;
  newPassword: string;
};

export type BillingPlanKey = 'omp_80' | 'omp_150' | 'omp_250';
