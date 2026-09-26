import { HttpsError } from 'firebase-functions/v2/https';

import { adminDb } from '../config/firebaseAdmin.js';
import type { UserPermissions } from '../shared/derived-permissions.js';
import { hasPermission } from '../shared/permissions.js';

type UserRole = 'admin' | 'supervisor' | 'user';
export type RequesterProfile = {
  role: UserRole;
  isActive: boolean;
  congregationId: string;
  displayName?: string;
  email?: string;
  servicePosition?: string;
  serviceDepartment?: string;
  serviceAssignments?: { position?: string; department?: string }[];
  permissions?: UserPermissions;
  derivedPermissions?: UserPermissions;
};

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};
const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? value as Record<string, unknown> : null;
const normalizeRole = (value: unknown): UserRole | undefined => {
  if (value === 'admin' || value === 'supervisor' || value === 'user') return value;
  if (value === 'administrador') return 'admin';
  if (value === 'usuario') return 'user';
  return undefined;
};
const resolveIsActive = (data: Record<string, unknown>): boolean => {
  if (typeof data.isActive === 'boolean') return data.isActive;
  return data.status === 'active';
};
const toServiceAssignments = (value: unknown): { position?: string; department?: string }[] => {
  if (!Array.isArray(value)) return [];
  return value.map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => ({ position: normalizeText(item.position), department: normalizeText(item.department) }));
};

export const getRequesterProfile = async (uid: string): Promise<RequesterProfile> => {
  const snap = await adminDb.collection('users').doc(uid).get();
  if (!snap.exists) throw new HttpsError('permission-denied', 'No existe perfil del usuario autenticado.');
  const data = snap.data() as Record<string, unknown>;
  const congregationId = normalizeText(data.congregationId);
  if (!congregationId || !resolveIsActive(data)) {
    throw new HttpsError('permission-denied', 'Perfil de usuario invalido o inactivo.');
  }
  return {
    role: normalizeRole(data.role) ?? 'user', isActive: true, congregationId,
    displayName: normalizeText(data.displayName), email: normalizeText(data.email),
    servicePosition: normalizeText(data.servicePosition), serviceDepartment: normalizeText(data.serviceDepartment),
    serviceAssignments: toServiceAssignments(data.serviceAssignments),
    permissions: asRecord(data.permissions) as RequesterProfile['permissions'],
    derivedPermissions: asRecord(data.derivedPermissions) as RequesterProfile['derivedPermissions'],
  };
};

const hasServiceAssignment = (requester: RequesterProfile, position: string, department: string): boolean =>
  (requester.servicePosition === position && requester.serviceDepartment === department) ||
  requester.serviceAssignments?.some((assignment) =>
    assignment.position === position && assignment.department === department
  ) === true;

const assertSameCongregation = (requester: RequesterProfile, congregationId: string): void => {
  if (requester.congregationId !== congregationId) {
    throw new HttpsError('permission-denied', 'No puedes gestionar otra congregacion.');
  }
};

export const assertCleaningManager = (requester: RequesterProfile, congregationId: string): void => {
  assertSameCongregation(requester, congregationId);
  if (requester.role !== 'admin' && !hasPermission(requester, 'limpieza', 'manage') &&
      !(hasPermission(requester, 'limpieza', 'create') && hasPermission(requester, 'limpieza', 'edit')) &&
      !hasServiceAssignment(requester, 'encargado', 'limpieza')) {
    throw new HttpsError('permission-denied', 'No tienes permisos para publicar limpieza.');
  }
};

export const assertHospitalityManager = (requester: RequesterProfile, congregationId: string): void => {
  assertSameCongregation(requester, congregationId);
  if (requester.role !== 'admin' && !hasPermission(requester, 'acomodadores_microfonos', 'manage') &&
      !(hasPermission(requester, 'acomodadores_microfonos', 'create') && hasPermission(requester, 'acomodadores_microfonos', 'edit')) &&
      !hasServiceAssignment(requester, 'encargado', 'acomodadores_microfonos')) {
    throw new HttpsError('permission-denied', 'No tienes permisos para publicar acomodadores y microfonos.');
  }
};

export const assertHospitalityEditor = (requester: RequesterProfile, congregationId: string): void => {
  assertSameCongregation(requester, congregationId);
  if (requester.role !== 'admin' && !hasPermission(requester, 'acomodadores_microfonos', 'manage') &&
      !(hasPermission(requester, 'acomodadores_microfonos', 'create') && hasPermission(requester, 'acomodadores_microfonos', 'edit')) &&
      !hasPermission(requester, 'acomodadores_microfonos', 'edit') &&
      !hasServiceAssignment(requester, 'encargado', 'acomodadores_microfonos') &&
      !hasServiceAssignment(requester, 'auxiliar', 'acomodadores_microfonos')) {
    throw new HttpsError('permission-denied', 'No tienes permisos para editar acomodadores y microfonos.');
  }
};
