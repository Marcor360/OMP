import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { normalizeRole, parsePermissions } from './parsers.js';
import type {
  CreateUserPayload,
  PermissionAction,
  PermissionDepartment,
  RequesterProfile,
  UpdateUserPayload,
  UserPermissions,
} from './types.js';

export const hasCoordinatorOrSecretaryAssignment = (
  assignments: ReadonlyArray<{ position?: string }> | undefined
): boolean =>
  Array.isArray(assignments) &&
  assignments.some((assignment) => assignment?.position === 'coordinador' || assignment?.position === 'secretario');

export const isSystemRootUser = (flags: {
  isSystemUser?: boolean;
  isPrimaryAdmin?: boolean;
  isRootAdmin?: boolean;
  systemProtected?: boolean;
}): boolean =>
  flags.isSystemUser === true ||
  flags.isPrimaryAdmin === true ||
  flags.isRootAdmin === true ||
  flags.systemProtected === true;

export const stripOrgChartManageUnlessAuthorized = (
  permissions: UserPermissions | undefined,
  assignments: ReadonlyArray<{ position?: string }> | undefined,
  flags: { isSystemUser?: boolean; isPrimaryAdmin?: boolean; isRootAdmin?: boolean; systemProtected?: boolean }
): UserPermissions | undefined => {
  if (!permissions) return permissions;
  if (hasCoordinatorOrSecretaryAssignment(assignments) || isSystemRootUser(flags)) {
    return permissions;
  }

  for (const key of ['departments', 'organigrama'] as const) {
    const block = permissions[key];
    if (block?.manage === true) {
      delete block.manage;
      if (Object.keys(block).length === 0) {
        delete permissions[key];
      }
    }
  }

  return permissions;
};

export async function getRequesterProfile(uid: string): Promise<RequesterProfile> {
  const db = getFirestore();
  const snap = await db.collection('users').doc(uid).get();

  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'No existe perfil del usuario autenticado.');
  }

  const data = snap.data();
  if (!data?.isActive) {
    throw new HttpsError('permission-denied', 'El usuario autenticado esta inactivo.');
  }

  const role = normalizeRole(data.role);
  if (!role) {
    throw new HttpsError('permission-denied', 'Rol de usuario invalido.');
  }

  return {
    ...(data as RequesterProfile),
    role,
    permissions: parsePermissions(data.permissions, { strict: false }),
  };
}

export const billingTimestampToMillis = (value: unknown): number | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { toMillis?: unknown };
  if (typeof candidate.toMillis !== 'function') return null;
  const millis = candidate.toMillis() as number;
  return Number.isFinite(millis) ? millis : null;
};

export const isBillingExemptionActive = (data: Record<string, unknown>): boolean => {
  const exemption = data.billingExemption;
  if (typeof exemption !== 'object' || exemption === null || Array.isArray(exemption)) {
    return false;
  }

  const source = exemption as Record<string, unknown>;
  if (source.exempt !== true) return false;

  const expiresAt = billingTimestampToMillis(source.expiresAt);
  return expiresAt === null || expiresAt > Date.now();
};

export const assertAdministrativeBillingAccess = async (
  congregationId: string
): Promise<void> => {
  const snap = await getFirestore().collection('congregations').doc(congregationId).get();
  if (!snap.exists) return;

  const data = snap.data() as Record<string, unknown>;
  if (isBillingExemptionActive(data)) return;

  const billing = data.billing;
  if (typeof billing !== 'object' || billing === null || Array.isArray(billing)) {
    return;
  }

  const source = billing as Record<string, unknown>;
  const status = typeof source.status === 'string' ? source.status : '';
  const graceUntil = billingTimestampToMillis(source.graceUntil);
  const restricted =
    source.provider === 'stripe' &&
    (
      source.adminRestricted === true ||
      status === 'unpaid' ||
      status === 'canceled' ||
      status === 'incomplete_expired' ||
      (
        (status === 'past_due' || status === 'payment_action_required' || status === 'incomplete') &&
        graceUntil !== null &&
        graceUntil <= Date.now()
      )
    );

  if (restricted) {
    throw new HttpsError(
      'failed-precondition',
      'La facturacion de la congregacion requiere atencion antes de realizar cambios administrativos.'
    );
  }
};

export const requesterHasPermission = (
  profile: Pick<RequesterProfile, 'role' | 'permissions'>,
  department: PermissionDepartment,
  action: PermissionAction
): boolean =>
  profile.role === 'admin' ||
  profile.permissions?.[department]?.[action] === true ||
  profile.permissions?.[department]?.manage === true;

export function assertUserPermission(
  profile: RequesterProfile,
  action: PermissionAction
) {
  if (!requesterHasPermission(profile, 'usuarios', action)) {
    throw new HttpsError('permission-denied', 'No tienes permisos para gestionar usuarios.');
  }
}

export const requesterHasGlobalScreenAccess = (profile: RequesterProfile): boolean =>
  profile.role === 'admin' ||
  profile.servicePosition === 'coordinador' ||
  profile.servicePosition === 'secretario' ||
  profile.protectedFromDeletion === true ||
  profile.isSystemUser === true ||
  profile.isPrimaryAdmin === true ||
  profile.isRootAdmin === true ||
  profile.systemProtected === true;

export function assertCanListUsers(profile: RequesterProfile) {
  const canList =
    profile.role === 'admin' ||
    profile.role === 'supervisor' ||
    requesterHasGlobalScreenAccess(profile) ||
    profile.permissions?.departments?.manage === true ||
    requesterHasPermission(profile, 'usuarios', 'view') ||
    requesterHasPermission(profile, 'usuarios', 'manage');

  if (!canList) {
    throw new HttpsError('permission-denied', 'No tienes permisos para ver usuarios.');
  }
}

export const assertDelegatedCreateIsSafe = (requester: RequesterProfile, payload: CreateUserPayload) => {
  if (requester.role === 'admin') return;

  if (
    payload.role !== 'user' ||
    (payload.privileges && Object.keys(payload.privileges).length > 0) ||
    (payload.responsibilities && Object.keys(payload.responsibilities).length > 0) ||
    (payload.permissions && Object.keys(payload.permissions).length > 0) ||
    payload.serviceAssignments.length > 0
  ) {
    throw new HttpsError(
      'permission-denied',
      'Los permisos delegados no permiten asignar rol, privilegios ni funciones.'
    );
  }
};

export const assertDelegatedUpdateIsSafe = (
  requester: RequesterProfile,
  payload: UpdateUserPayload
) => {
  if (requester.role === 'admin') return;

  if (
    payload.role ||
    payload.privilegesProvided ||
    payload.responsibilitiesProvided ||
    payload.permissionsProvided ||
    payload.serviceAssignmentsProvided ||
    payload.serviceAssignmentProvided
  ) {
    throw new HttpsError(
      'permission-denied',
      'Los permisos delegados no permiten cambiar rol, permisos, privilegios ni funciones.'
    );
  }
};
