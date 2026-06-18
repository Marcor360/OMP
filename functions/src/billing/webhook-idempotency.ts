import { FieldValue, Timestamp, type DocumentReference } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

// Ledger de idempotencia de webhooks (coleccion raiz). Solo lo escribe el Admin SDK.
export const WEBHOOK_EVENTS_COLLECTION = 'stripeWebhookEvents';
// Stripe reintenta como maximo ~3 dias; 30 dias deja margen amplio antes de purgar.
export const WEBHOOK_EVENTS_RETENTION_DAYS = 30;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type WebhookClaimResult = 'claimed' | 'duplicate';

/**
 * Detecta el error ALREADY_EXISTS de Firestore, que `.create()` lanza al apuntar
 * a un documento que ya existe. Es la senal atomica de que el evento de Stripe ya
 * fue reclamado por otra entrega (incluso concurrente).
 */
export const isAlreadyExistsError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const code = (error as { code?: number | string }).code;
  return code === 6 || code === 'already-exists' || code === 'ALREADY_EXISTS';
};

/**
 * Reclama el evento de forma atomica con `.create()`.
 * - `claimed`: somos los primeros en procesarlo.
 * - `duplicate`: ya estaba reclamado; el llamador debe cortar sin reprocesar.
 * Cualquier otro error se relanza (no se puede asumir idempotencia).
 */
export const claimWebhookEvent = async (
  ref: DocumentReference,
  eventType: string
): Promise<WebhookClaimResult> => {
  try {
    await ref.create({
      type: eventType,
      status: 'processing',
      receivedAt: FieldValue.serverTimestamp(),
      expireAt: Timestamp.fromMillis(Date.now() + WEBHOOK_EVENTS_RETENTION_DAYS * DAY_IN_MS),
    });
    return 'claimed';
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      return 'duplicate';
    }
    throw error;
  }
};

/** Marca el evento como procesado tras completar su manejo correctamente. */
export const markWebhookEventProcessed = (ref: DocumentReference): Promise<unknown> =>
  ref.set({ status: 'processed', processedAt: FieldValue.serverTimestamp() }, { merge: true });

/**
 * Libera la reclamacion para que el reintento legitimo de Stripe pueda reprocesar
 * un evento que fallo a mitad de camino. Nunca lanza: un fallo de limpieza no debe
 * enmascarar el error original del procesamiento.
 */
export const releaseWebhookEvent = async (
  ref: DocumentReference,
  eventId: string
): Promise<void> => {
  try {
    await ref.delete();
  } catch (cleanupError) {
    logger.error('[billing] webhook claim cleanup failed', {
      eventId,
      message: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
    });
  }
};
