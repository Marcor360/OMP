import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getRequesterProfile } from '../users/authorization.js';
import type { RequesterProfile } from '../users/types.js';
import { reconcileOrgChartProjection } from './org-chart-projection.js';

const RELEVANT_FIELDS = [
  'serviceAssignments',
  'servicePosition',
  'serviceDepartment',
  'isActive',
  'displayName',
  'email',
  'congregationId',
  'role',
] as const;

const changedRelevantField = (
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined
): boolean => {
  if (!before || !after) return true; // create o delete
  return RELEVANT_FIELDS.some(
    (key) => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null)
  );
};

// Solo Coordinador/Secretario (+ root/system). NO admin normal, para coincidir con
// canManageDepartments del cliente y con lo pedido por el owner.
const requesterCanManageOrgChart = (profile: RequesterProfile): boolean =>
  profile.servicePosition === 'coordinador' ||
  profile.servicePosition === 'secretario' ||
  profile.isRootAdmin === true ||
  profile.isPrimaryAdmin === true ||
  profile.isSystemUser === true ||
  profile.systemProtected === true ||
  profile.protectedFromDeletion === true;

// (A) Reactividad: fuente de verdad = user.serviceAssignments. Al cambiar, regenera
// la proyeccion. Escribe solo en departments/departmentAssignments -> sin bucles.
export const reconcileOrgChartOnUserWrite = onDocumentWritten(
  { region: 'us-central1', document: 'users/{uid}' },
  async (event) => {
    const before = event.data?.before?.data() as Record<string, unknown> | undefined;
    const after = event.data?.after?.data() as Record<string, unknown> | undefined;

    if (!changedRelevantField(before, after)) return;

    const congregationId = String((after?.congregationId ?? before?.congregationId) ?? '').trim();
    if (!congregationId) return;

    try {
      await reconcileOrgChartProjection(congregationId, getFirestore());
    } catch (error) {
      logger.error('reconcileOrgChartOnUserWrite failed', { congregationId, error });
    }
  }
);

// (B) Boton "Generar": ignora cualquier congregationId del cliente y usa el del
// solicitante. Autoriza Coordinador/Secretario (+ root/system).
export const regenerateOrgChart = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
  }

  const requester = await getRequesterProfile(request.auth.uid);
  if (!requesterCanManageOrgChart(requester)) {
    throw new HttpsError('permission-denied', 'Solo el coordinador o el secretario pueden generar el organigrama.');
  }

  const congregationId = requester.congregationId;
  if (!congregationId) {
    throw new HttpsError('failed-precondition', 'Tu usuario no tiene congregacion asignada.');
  }

  const result = await reconcileOrgChartProjection(congregationId, getFirestore());
  return { ok: true, ...result };
});
