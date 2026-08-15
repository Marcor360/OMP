import { logger } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

import { adminDb } from '../config/firebaseAdmin.js';
import {
  getPermissionsFromServiceAssignments,
  permissionsEqual,
  ServiceAssignmentLike,
  UserPermissions,
} from '../shared/derived-permissions.js';

const RELEVANT_FIELDS = ['servicePosition', 'serviceDepartment', 'serviceAssignments'] as const;

// Exportada para pruebas puras. Solo estos tres campos determinan
// derivedPermissions; cualquier otro cambio (displayName, permissions
// otorgados a mano, etc.) no debe disparar un recalculo.
export const changedRelevantField = (
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined
): boolean => {
  if (!before || !after) return true; // create: no hay "before" que comparar.
  return RELEVANT_FIELDS.some(
    (key) => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null)
  );
};

export type DerivedPermissionsDecision =
  | { shouldWrite: false }
  | { shouldWrite: true; derivedPermissions: UserPermissions };

// Decision pura (sin Firestore) de si hay que reescribir derivedPermissions.
// Dos guardas anti-bucle independientes, ambas necesarias:
//   1. changedRelevantField: la propia escritura de este trigger (solo toca
//      derivedPermissions) hace que la SIGUIENTE invocacion vea
//      before.servicePosition/serviceDepartment/serviceAssignments ==
//      after.*, asi que corta aqui sin llegar a comparar permisos.
//   2. permissionsEqual: red de seguridad para cuando esos campos cambian
//      sintacticamente (p. ej. reordenar el array) pero el resultado derivado
//      es identico -- evita una escritura sin cambio real.
export const decideDerivedPermissionsUpdate = (
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined
): DerivedPermissionsDecision => {
  if (!after) return { shouldWrite: false }; // documento borrado: nada que reconciliar.
  if (!changedRelevantField(before, after)) return { shouldWrite: false };

  const derived = getPermissionsFromServiceAssignments({
    servicePosition: typeof after.servicePosition === 'string' ? after.servicePosition : undefined,
    serviceDepartment: typeof after.serviceDepartment === 'string' ? after.serviceDepartment : undefined,
    serviceAssignments: Array.isArray(after.serviceAssignments)
      ? (after.serviceAssignments as ServiceAssignmentLike[])
      : undefined,
  });

  const stored = (after.derivedPermissions ?? null) as UserPermissions | null;
  if (permissionsEqual(derived, stored)) return { shouldWrite: false };

  return { shouldWrite: true, derivedPermissions: derived };
};

// (A) Fase 0: fuente de verdad = servicePosition/serviceDepartment/
// serviceAssignments. Al cambiar, recalcula derivedPermissions y escribe SOLO
// ese campo -- nunca permissions (otorgado a mano), role ni serviceAssignments.
// Mismo patron reactivo que reconcileOrgChartOnUserWrite (ya en produccion).
export const reconcileDerivedPermissionsOnUserWrite = onDocumentWritten(
  { region: 'us-central1', document: 'users/{uid}' },
  async (event) => {
    const uid = event.params.uid;
    const before = event.data?.before?.data() as Record<string, unknown> | undefined;
    const after = event.data?.after?.data() as Record<string, unknown> | undefined;

    const decision = decideDerivedPermissionsUpdate(before, after);
    if (!decision.shouldWrite) return;

    try {
      await adminDb.collection('users').doc(uid).update({
        derivedPermissions: decision.derivedPermissions,
      });
    } catch (error) {
      logger.error('reconcileDerivedPermissionsOnUserWrite failed', { uid, error });
    }
  }
);
