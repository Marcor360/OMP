import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { isSystemPrincipalUser } from '../user-protection.js';

const getRequesterForExemption = async (uid: string) => {
  const snap = await getFirestore().collection('users').doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError('permission-denied', 'No existe perfil del usuario autenticado.');
  }
  const data = snap.data() as Record<string, unknown>;
  if (data.isActive !== true) {
    throw new HttpsError('permission-denied', 'Tu usuario esta inactivo.');
  }
  const congregationId = typeof data.congregationId === 'string' ? data.congregationId : null;
  return { data, congregationId };
};

/**
 * Allows the primary/root admin to grant or revoke a permanent billing exemption
 * for their congregation. This unblocks all administrative user operations even when
 * the Stripe subscription is in a restricted state (unpaid, canceled, etc.).
 *
 * Only callable by users with system-level protection flags (isPrimaryAdmin,
 * isRootAdmin, isSystemUser, systemProtected, protectedFromDeletion).
 */
export const setBillingExemptionByRootAdmin = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const { exempt } = request.data as Record<string, unknown>;
    if (typeof exempt !== 'boolean') {
      throw new HttpsError('invalid-argument', 'El campo "exempt" debe ser true o false.');
    }

    const { data, congregationId } = await getRequesterForExemption(request.auth.uid);
    if (!congregationId) {
      throw new HttpsError('failed-precondition', 'Tu cuenta no tiene una congregacion asignada.');
    }

    if (!isSystemPrincipalUser(data)) {
      throw new HttpsError(
        'permission-denied',
        'Solo el administrador raiz puede gestionar exenciones de facturacion.'
      );
    }

    const ref = getFirestore().collection('congregations').doc(congregationId);

    if (exempt) {
      await ref.update({ billingExemption: { exempt: true } });
    } else {
      await ref.update({ billingExemption: FieldValue.delete() });
    }

    return { ok: true, congregationId, exempt };
  }
);
