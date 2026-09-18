import { logger } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

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

// Errores de validacion/permisos no se arreglan reintentando el mismo evento.
// Las fallas de red, cuota o disponibilidad se propagan: Eventarc las vuelve a
// entregar porque el trigger declara retry:true.
export const isRetryableDerivedPermissionsError = (error: unknown): boolean => {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
  return !['invalid-argument', 'permission-denied', 'failed-precondition'].includes(code);
};

export const reconcileDerivedPermissionsDocument = async (
  uid: string,
  data: Record<string, unknown>
): Promise<boolean> => {
  const decision = decideDerivedPermissionsUpdate(undefined, data);
  if (!decision.shouldWrite) return false;

  await adminDb.collection('users').doc(uid).update({
    derivedPermissions: decision.derivedPermissions,
  });
  return true;
};

// (A) Fase 0: fuente de verdad = servicePosition/serviceDepartment/
// serviceAssignments. Al cambiar, recalcula derivedPermissions y escribe SOLO
// ese campo -- nunca permissions (otorgado a mano), role ni serviceAssignments.
// Mismo patron reactivo que reconcileOrgChartOnUserWrite (ya en produccion).
export const reconcileDerivedPermissionsOnUserWrite = onDocumentWritten(
  { region: 'us-central1', document: 'users/{uid}', retry: true },
  async (event) => {
    const uid = event.params.uid;
    const before = event.data?.before?.data() as Record<string, unknown> | undefined;
    const after = event.data?.after?.data() as Record<string, unknown> | undefined;

    const decision = decideDerivedPermissionsUpdate(before, after);
    if (!decision.shouldWrite) return;

    try {
      await adminDb.collection('users').doc(uid).update({ derivedPermissions: decision.derivedPermissions });
    } catch (error) {
      const retryable = isRetryableDerivedPermissionsError(error);
      logger.error('reconcileDerivedPermissionsOnUserWrite failed', { uid, retryable, error });
      if (retryable) throw error;
    }
  }
);

// Segunda linea de defensa para eventos perdidos o fallas deterministicas ya
// corregidas. Lee solo los campos requeridos y escribe unicamente divergencias.
// Se seleccionan solo los campos necesarios y se escribe exclusivamente cuando
// hay divergencia; no se monta ningun listener para esta reconciliacion.
export const reconcileDerivedPermissionsScheduled = onSchedule(
  { schedule: 'every day 03:17', region: 'us-central1', timeoutSeconds: 540, maxInstances: 1 },
  async () => {
    const users = await adminDb.collection('users')
      .select('servicePosition', 'serviceDepartment', 'serviceAssignments', 'derivedPermissions')
      .get();

    let updated = 0;
    for (const user of users.docs) {
      if (await reconcileDerivedPermissionsDocument(user.id, user.data() as Record<string, unknown>)) {
        updated += 1;
      }
    }
    logger.info('reconcileDerivedPermissionsScheduled completed', { scanned: users.size, updated });
  }
);
