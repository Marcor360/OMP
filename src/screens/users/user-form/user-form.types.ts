import type { CongregationPlanUsage } from '@/src/types/congregation-plan';
import type {
  PermissionAction,
  PermissionDepartment,
  TerritoryPermissionAction,
  UserGender,
  UserPermissions,
  UserPrivileges,
  UserRole,
  UserServiceAssignment,
  UserServiceDepartment,
  UserServicePosition,
} from '@/src/types/user';

export type UserFormMode = 'create' | 'edit';
export type ServiceSelection = UserServicePosition | 'none';

export type UserFormErrors = {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  newPassword?: string;
  gender?: string;
  assignment?: string;
  privileges?: string;
};

export type UserFormState = {
  displayName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  secondLastName: string;
  password: string;
  newPassword: string;
  showPassword: boolean;
  showNewPassword: boolean;
  role: UserRole;
  gender: UserGender | null;
  phone: string;
  servicePositionDraft: ServiceSelection;
  serviceDepartmentDraft: UserServiceDepartment | '';
  serviceAssignments: UserServiceAssignment[];
  privileges: UserPrivileges;
  permissions: UserPermissions;
  planUsage: CongregationPlanUsage | null;
  errors: UserFormErrors;
  loading: boolean;
  loadingProfile: boolean;
  saving: boolean;
  canEdit: boolean;
  isAdmin: boolean;
  generatedEmailPreview: string;
  positionOptions: ServiceSelection[];
  selectedDraftAssignment: UserServiceAssignment | null;
  requiresAdminElder: boolean;
  allowedPermissionLabels: string[];
};

export type UserFormActions = {
  setDisplayName: (value: string) => void;
  setFirstName: (value: string) => void;
  setMiddleName: (value: string) => void;
  setLastName: (value: string) => void;
  setSecondLastName: (value: string) => void;
  setPassword: (value: string) => void;
  setNewPassword: (value: string) => void;
  setRole: (value: UserRole) => void;
  setGender: (value: UserGender) => void;
  setPhone: (value: string) => void;
  setServicePositionDraft: (value: ServiceSelection) => void;
  setServiceDepartmentDraft: (value: UserServiceDepartment | '') => void;
  togglePasswordVisibility: () => void;
  toggleNewPasswordVisibility: () => void;
  handleCopyValue: (label: string, value: string) => Promise<void>;
  addServiceAssignment: () => void;
  removeServiceAssignment: (assignment: UserServiceAssignment) => void;
  togglePrivilege: (key: keyof UserPrivileges) => void;
  togglePermission: (department: PermissionDepartment, action: PermissionAction) => void;
  toggleTerritoryPermission: (action: TerritoryPermissionAction) => void;
  isPositionOccupied: (position: ServiceSelection) => boolean;
  isDepartmentOccupied: (department: UserServiceDepartment) => boolean;
  isDraftAssignmentUnavailable: (assignment: UserServiceAssignment | null) => boolean;
  handleSave: () => Promise<void>;
};

export type UserFormController = {
  mode: UserFormMode;
  state: UserFormState;
  actions: UserFormActions;
};
