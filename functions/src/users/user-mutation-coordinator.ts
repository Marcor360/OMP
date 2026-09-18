import { logger } from 'firebase-functions';

type ReversibleAuthUser = {
  displayName?: string;
  disabled?: boolean;
};

type ReversibleAuth = {
  getUser(uid: string): Promise<ReversibleAuthUser>;
  updateUser(uid: string, updates: ReversibleAuthUser): Promise<unknown>;
};

export type ReversibleUserMutation = {
  operationId: string;
  uid: string;
  auth: ReversibleAuth;
  authUpdates: ReversibleAuthUser;
  applyFirestore: () => Promise<unknown>;
};

/**
 * Coordina el pequeño tramo Auth -> Firestore que sí admite compensación.
 * No pretende simular una transacción distribuida: si la compensación falla,
 * deja una señal operativa inequívoca para el reconciliador/auditoría.
 */
export const runReversibleUserMutation = async ({
  operationId,
  uid,
  auth,
  authUpdates,
  applyFirestore,
}: ReversibleUserMutation): Promise<void> => {
  if (Object.keys(authUpdates).length === 0) {
    await applyFirestore();
    return;
  }

  const previous = await auth.getUser(uid);
  await auth.updateUser(uid, authUpdates);

  try {
    await applyFirestore();
  } catch (firestoreError) {
    const rollback: ReversibleAuthUser = {};
    if ('displayName' in authUpdates) rollback.displayName = previous.displayName;
    if ('disabled' in authUpdates) rollback.disabled = previous.disabled;

    try {
      await auth.updateUser(uid, rollback);
      logger.warn('User mutation compensated after Firestore failure', {
        operationId, uid, firestoreError,
      });
    } catch (compensationError) {
      logger.error('CRITICAL user mutation compensation failed; reconciliation required', {
        operationId, uid, firestoreError, compensationError, reconciliationRequired: true,
      });
    }
    throw firestoreError;
  }
};
