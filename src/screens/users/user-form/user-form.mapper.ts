import type { CreateUserByAdminPayload } from '@/src/services/users/admin-users-service';
import type {
  AppUser,
  UpdateUserDTO,
  UserPrivileges,
  UserResponsibilities,
  UserRole,
  UserServiceAssignment,
  UserServiceDepartment,
} from '@/src/types/user';
import {
  USER_SERVICE_DEPARTMENT_LABELS,
} from '@/src/types/user';
import type { ServiceSelection } from '@/src/screens/users/user-form/user-form.types';

export const DEPARTMENT_LABEL_TO_KEY: Record<string, UserServiceDepartment> = Object.fromEntries(
  Object.entries(USER_SERVICE_DEPARTMENT_LABELS).map(([key, label]) => [
    label,
    key as UserServiceDepartment,
  ])
) as Record<string, UserServiceDepartment>;

export const normalizeNameForEmail = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export const buildGeneratedEmailPreview = (
  firstName: string,
  middleName: string,
  lastName: string,
  domain: string
): string => {
  const primary = `${normalizeNameForEmail(firstName)}${normalizeNameForEmail(lastName)}`;
  const fallback =
    `${normalizeNameForEmail(firstName)}${normalizeNameForEmail(middleName)}${normalizeNameForEmail(lastName)}` ||
    'usuario';
  return `${primary || fallback}@${domain.toLowerCase()}`;
};

export const parseLegacyAssignment = (
  value: string | undefined
): { position: ServiceSelection; department: UserServiceDepartment | '' } => {
  if (!value) return { position: 'none', department: '' };
  if (value === 'Coordinador' || value === 'Coordinator') {
    return { position: 'coordinador', department: '' };
  }
  if (value === 'Secretario' || value === 'Secretary') {
    return { position: 'secretario', department: '' };
  }
  if (value.startsWith('Encargado de ') || value.startsWith('Overseer of ')) {
    const label = value.replace('Encargado de ', '').replace('Overseer of ', '').trim();
    return { position: 'encargado', department: DEPARTMENT_LABEL_TO_KEY[label] ?? '' };
  }
  if (value.startsWith('Auxiliar de ') || value.startsWith('Assistant of ')) {
    const label = value.replace('Auxiliar de ', '').replace('Assistant of ', '').trim();
    return { position: 'auxiliar', department: DEPARTMENT_LABEL_TO_KEY[label] ?? '' };
  }
  return { position: 'none', department: '' };
};

export const needsDepartment = (position: ServiceSelection): boolean =>
  position === 'encargado' || position === 'auxiliar';

export const buildDepartmentLabel = (
  position: ServiceSelection,
  department: UserServiceDepartment | ''
): string | undefined => {
  if (position === 'coordinador') return 'Coordinador';
  if (position === 'secretario') return 'Secretario';
  if (position === 'encargado' && department) {
    return `Encargado de ${USER_SERVICE_DEPARTMENT_LABELS[department]}`;
  }
  if (position === 'auxiliar' && department) {
    return `Auxiliar de ${USER_SERVICE_DEPARTMENT_LABELS[department]}`;
  }
  return undefined;
};

export const resolveServiceAssignmentFromUser = (
  user: Pick<AppUser, 'servicePosition' | 'serviceDepartment' | 'department' | 'serviceAssignments'>
): UserServiceAssignment[] => {
  const assignments = user.serviceAssignments ?? [];
  if (assignments.length > 0) return assignments;

  const legacy = user.servicePosition
    ? {
        position: user.servicePosition,
        department:
          user.serviceDepartment ??
          (
            user.servicePosition === 'encargado' || user.servicePosition === 'auxiliar'
              ? parseLegacyAssignment(user.department).department || undefined
              : undefined
          ),
      }
    : parseLegacyAssignment(user.department);
  const label = buildDepartmentLabel(legacy.position ?? 'none', legacy.department ?? '');
  return legacy.position && legacy.position !== 'none' && label
    ? [{ position: legacy.position, department: legacy.department || undefined, label }]
    : [];
};

export const assignmentKey = (
  assignment: Pick<UserServiceAssignment, 'position' | 'department'>
): string => `${assignment.position}:${assignment.department ?? ''}`;

export const normalizeServiceAssignmentForPayload = (
  assignment: UserServiceAssignment
): UserServiceAssignment => {
  const normalized: UserServiceAssignment = {
    position: assignment.position,
    label: assignment.label,
  };
  if (assignment.department) {
    normalized.department = assignment.department;
  }
  return normalized;
};

export const requiresAdminElderAssignment = (
  assignments: Pick<UserServiceAssignment, 'position'>[]
): boolean =>
  assignments.some(
    (assignment) => assignment.position === 'coordinador' || assignment.position === 'secretario'
  );

export const ensureAdminElderPrivileges = (
  assignments: Pick<UserServiceAssignment, 'position'>[],
  current: UserPrivileges
): UserPrivileges =>
  requiresAdminElderAssignment(assignments)
    ? {
        ...current,
        isElder: true,
        isMinisterialServant: false,
      }
    : current;

type BuildUserPayloadParams = {
  mode: 'create' | 'edit';
  isAdmin: boolean;
  displayName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  secondLastName: string;
  password: string;
  email: string;
  role: UserRole;
  congregationId: string;
  gender: NonNullable<AppUser['gender']>;
  phone: string;
  serviceAssignments: UserServiceAssignment[];
  privileges: UserPrivileges;
  responsibilities: UserResponsibilities;
  permissions: AppUser['permissions'];
};

const compactName = (items: (string | undefined)[]): string =>
  items.filter(Boolean).join(' ').trim();

const getPrimaryAssignmentParts = (serviceAssignments: UserServiceAssignment[]) => {
  const primaryAssignment = serviceAssignments[0];
  return {
    departmentLabel: primaryAssignment?.label,
    servicePosition: primaryAssignment?.position,
    serviceDepartment: primaryAssignment?.department,
  };
};

export const toCreatePayload = (params: BuildUserPayloadParams): CreateUserByAdminPayload => {
  const normalizedMiddle = params.middleName.trim() || undefined;
  const normalizedFirstName = params.firstName.trim();
  const normalizedLastName = params.lastName.trim();
  const normalizedSecondLastName = params.secondLastName.trim() || undefined;
  const normalizedPhone = params.phone.trim() || undefined;
  const { departmentLabel, servicePosition, serviceDepartment } =
    getPrimaryAssignmentParts(params.serviceAssignments);

  return {
    firstName: normalizedFirstName,
    middleName: normalizedMiddle,
    lastName: normalizedLastName,
    secondLastName: normalizedSecondLastName,
    password: params.password.trim(),
    displayName: compactName([
      normalizedFirstName,
      normalizedMiddle,
      normalizedLastName,
      normalizedSecondLastName,
    ]),
    email: params.email,
    role: params.role,
    congregationId: params.congregationId,
    gender: params.gender,
    phone: normalizedPhone,
    department: departmentLabel,
    servicePosition,
    serviceDepartment,
    serviceAssignments: params.serviceAssignments,
    privileges: params.privileges,
    responsibilities: params.responsibilities,
    permissions: params.role === 'supervisor' ? params.permissions : undefined,
    isElder: params.privileges.isElder === true,
    isMinisterialServant: params.privileges.isMinisterialServant === true,
    isActive: true,
  };
};

export const toUpdatePayload = (params: BuildUserPayloadParams): UpdateUserDTO => {
  if (!params.isAdmin) {
    return {
      displayName: params.displayName.trim(),
      gender: params.gender,
      phone: params.phone.trim() || undefined,
    };
  }

  const { departmentLabel, servicePosition, serviceDepartment } =
    getPrimaryAssignmentParts(params.serviceAssignments);

  return {
    displayName: params.displayName.trim(),
    role: params.role,
    gender: params.gender,
    phone: params.phone.trim() || undefined,
    department: departmentLabel,
    servicePosition,
    serviceDepartment,
    serviceAssignments: params.serviceAssignments,
    privileges: params.privileges,
    responsibilities: params.responsibilities,
    permissions: params.role === 'supervisor' ? params.permissions : undefined,
    isElder: params.privileges.isElder === true,
    isMinisterialServant: params.privileges.isMinisterialServant === true,
  };
};

export const toPayload = (
  params: BuildUserPayloadParams
): CreateUserByAdminPayload | UpdateUserDTO =>
  params.mode === 'create' ? toCreatePayload(params) : toUpdatePayload(params);

export const toFormValues = (user: AppUser) => ({
  displayName: user.displayName,
  role: user.role,
  gender: user.gender ?? null,
  phone: user.phone ?? '',
  serviceAssignments: resolveServiceAssignmentFromUser(user),
  privileges: user.privileges ?? {},
  responsibilities: user.responsibilities ?? {},
  permissions: user.permissions ?? {},
});
