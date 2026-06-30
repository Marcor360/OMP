import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

import {
  canOperateBilling,
  canViewBilling,
  type BillingPagosAction,
} from '../../shared/billing-access.js';
import { listActiveUserDocsForCongregation } from './billing-state.js';

export type RequesterProfile = {
  uid: string;
  email?: string;
  displayName?: string;
  role?: string;
  isActive?: boolean;
  congregationId?: string;
  servicePosition?: string;
  serviceDepartment?: string;
  serviceAssignments?: {
    position?: string;
    department?: string;
  }[];
  permissions?: Record<string, Record<string, boolean>>;
};

const normalizeRole = (value: unknown): string | undefined => {
  if (value === 'admin' || value === 'supervisor' || value === 'user') return value;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'administrador') return 'admin';
  if (normalized === 'usuario') return 'user';
  return undefined;
};

export const getRequesterProfile = async (uid: string): Promise<RequesterProfile> => {
  const snap = await getFirestore().collection('users').doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'No existe perfil del usuario autenticado.');
  }

  const data = snap.data() as Record<string, unknown>;
  if (data.isActive !== true) {
    throw new HttpsError('permission-denied', 'Tu usuario esta inactivo.');
  }

  return {
    ...(data as RequesterProfile),
    uid,
    role: normalizeRole(data.role),
  };
};

export const billingDeps = (profile: RequesterProfile) => ({
  hasPagosPermission: (action: BillingPagosAction): boolean =>
    profile.permissions?.pagos?.[action] === true ||
    profile.permissions?.pagos?.manage === true,
});

export const assertBillingActor = async (
  uid: string,
  congregationId: string
): Promise<RequesterProfile> => {
  const profile = await getRequesterProfile(uid);
  if (profile.congregationId !== congregationId) {
    throw new HttpsError('permission-denied', 'No puedes gestionar pagos de otra congregacion.');
  }
  if (!canOperateBilling(profile, billingDeps(profile))) {
    throw new HttpsError('permission-denied', 'Solo coordinador o tesorero puede gestionar cobros.');
  }
  return profile;
};

export const assertBillingViewer = async (
  uid: string,
  congregationId: string
): Promise<RequesterProfile> => {
  const profile = await getRequesterProfile(uid);
  if (profile.congregationId !== congregationId) {
    throw new HttpsError('permission-denied', 'No puedes ver pagos de otra congregacion.');
  }
  if (!canViewBilling(profile, billingDeps(profile))) {
    throw new HttpsError('permission-denied', 'No tienes permiso para ver facturacion.');
  }
  return profile;
};

export const getBillingReminderTargets = async (congregationId: string): Promise<string[]> => {
  const docs = await listActiveUserDocsForCongregation(congregationId);

  return Array.from(
    new Set(
      docs
        .map((doc) => ({ uid: doc.id, data: doc.data() as RequesterProfile }))
        .filter(({ data }) => canViewBilling(data, billingDeps(data)))
        .map(({ uid }) => uid)
    )
  );
};
