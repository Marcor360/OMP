import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { onRequest } from 'firebase-functions/v2/https';

import {
  claimWebhookEvent,
  markWebhookEventProcessed,
  releaseWebhookEvent,
  WEBHOOK_EVENTS_COLLECTION,
  type WebhookClaimResult,
} from '../webhook-idempotency.js';
import { getBillingReminderTargets } from './authorization.js';
import { logError } from '../../shared/logging.js';
import {
  asTrimmedString,
  findCongregationBySubscription,
  getBillingAccessUpdate,
  getCongregationRef,
  getEventTimestamp,
  getInvoiceUrl,
  getObjectMetadata,
  getSubscriptionItems,
  resolveCustomerId,
  resolveSubscriptionId,
  timestampFromSeconds,
  updateCongregationFromSubscription,
  type BillingState,
  type StripeWebhookEvent,
} from './billing-state.js';
import {
  BILLING_HISTORY_COLLECTION,
  REGION,
  STRIPE_RUNTIME_SECRETS,
  STRIPE_WEBHOOK_SECRET,
  getSecret,
  getStripe,
  isBillingPlanKey,
  priceToPlanKey,
  type BillingPlanKey,
} from './stripe-client.js';

const MANAGED_EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_action_required',
]);

const handleCheckoutCompleted = async (
  stripe: ReturnType<typeof getStripe>,
  session: Record<string, unknown>,
  event?: Pick<StripeWebhookEvent, 'id' | 'created'>
): Promise<string | null> => {
  const subscriptionId = resolveSubscriptionId(session.subscription);
  const metadata = getObjectMetadata(session);
  const congregationId = asTrimmedString(metadata.congregationId);
  if (!subscriptionId || !congregationId) return null;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price'],
  });
  return updateCongregationFromSubscription(
    subscription as unknown as Record<string, unknown>,
    {
      congregationId,
      planKey: isBillingPlanKey(metadata.planKey) ? metadata.planKey : undefined,
    },
    event
  );
};

const handleInvoiceStatus = async (
  invoice: Record<string, unknown>,
  status: 'active' | 'past_due' | 'payment_action_required',
  lastPaymentStatus: 'paid' | 'payment_failed' | 'action_required',
  event?: Pick<StripeWebhookEvent, 'id' | 'created'>
): Promise<string | null> => {
  const rawInvoice = invoice as unknown as Record<string, unknown>;
  const subscriptionId = resolveSubscriptionId(rawInvoice.subscription);
  if (!subscriptionId) return null;
  const congregationId = await findCongregationBySubscription(subscriptionId);
  if (!congregationId) return null;

  const ref = getCongregationRef(congregationId);
  const snap = await ref.get();
  const existingBilling = snap.exists
    ? ((snap.data() as Record<string, unknown>).billing as BillingState | undefined)
    : undefined;
  const eventTimestamp = getEventTimestamp(event);

  await ref.set(
    {
      'billing.status': status,
      'billing.lastPaymentStatus': lastPaymentStatus,
      'billing.lastInvoiceId': asTrimmedString(invoice.id),
      'billing.lastInvoiceUrl': getInvoiceUrl(invoice),
      'billing.lastStripeEventId': event?.id ?? null,
      'billing.updatedAt': FieldValue.serverTimestamp(),
      ...getBillingAccessUpdate(status, existingBilling, eventTimestamp),
    },
    { merge: true }
  );

  return congregationId;
};

const getStripeObjectId = (value: Record<string, unknown>): string | null =>
  asTrimmedString(value.id);

const getStripeObjectCurrency = (value: Record<string, unknown>): string | null => {
  const currency = asTrimmedString(value.currency);
  return currency ? currency.toUpperCase() : null;
};

const getStripeObjectAmount = (value: Record<string, unknown>): number | null => {
  const cents =
    typeof value.amount_paid === 'number'
      ? value.amount_paid
      : typeof value.amount_due === 'number'
        ? value.amount_due
        : typeof value.total === 'number'
          ? value.total
          : typeof value.amount === 'number'
            ? value.amount
            : null;

  return typeof cents === 'number' && Number.isFinite(cents)
    ? Math.round(cents) / 100
    : null;
};

const getInvoiceSubscriptionId = (value: Record<string, unknown>): string | null =>
  resolveSubscriptionId(value.subscription) ??
  resolveSubscriptionId((value.parent as Record<string, unknown> | undefined)?.subscription_details);

const getInvoiceCustomerId = (value: Record<string, unknown>): string | null =>
  resolveCustomerId(value.customer);

const getEventPlanKey = (
  value: Record<string, unknown>,
  currentBilling?: BillingState
): BillingPlanKey | undefined => {
  const metadataPlan = getObjectMetadata(value).planKey;
  if (isBillingPlanKey(metadataPlan)) return metadataPlan;

  const price = getSubscriptionItems(value)[0]?.price;
  const priceId =
    typeof price === 'object' && price !== null
      ? asTrimmedString((price as Record<string, unknown>).id)
      : null;

  return priceToPlanKey(priceId) ?? currentBilling?.planKey;
};

const historyStatusForEvent = (
  eventType: string,
  value: Record<string, unknown>
): string => {
  if (eventType === 'invoice.paid') return 'paid';
  if (eventType === 'invoice.payment_failed') return 'payment_failed';
  if (eventType === 'invoice.payment_action_required') return 'payment_action_required';
  return asTrimmedString(value.status) ?? eventType;
};

const writeBillingHistory = async (
  congregationId: string,
  event: StripeWebhookEvent,
  object: Record<string, unknown>
): Promise<void> => {
  const congregationSnap = await getCongregationRef(congregationId).get();
  const currentBilling = congregationSnap.exists
    ? ((congregationSnap.data() as Record<string, unknown>).billing as BillingState | undefined)
    : undefined;

  const subscriptionId =
    resolveSubscriptionId(object.subscription) ??
    resolveSubscriptionId(object.id) ??
    getInvoiceSubscriptionId(object) ??
    currentBilling?.stripeSubscriptionId ??
    null;

  await getCongregationRef(congregationId)
    .collection(BILLING_HISTORY_COLLECTION)
    .doc(event.id)
    .set(
      {
        provider: 'stripe',
        type: event.type,
        status: historyStatusForEvent(event.type, object),
        amount: getStripeObjectAmount(object),
        currency: getStripeObjectCurrency(object) ?? 'MXN',
        planKey: getEventPlanKey(object, currentBilling) ?? null,
        stripeEventId: event.id,
        stripeInvoiceId: event.type.startsWith('invoice.') ? getStripeObjectId(object) : null,
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId:
          getInvoiceCustomerId(object) ??
          resolveCustomerId(object.customer) ??
          currentBilling?.stripeCustomerId ??
          null,
        hostedInvoiceUrl: getInvoiceUrl(object),
        createdAt: timestampFromSeconds(event.created) ?? FieldValue.serverTimestamp(),
        processedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
};

const createBillingNotification = async (params: {
  congregationId: string;
  userIds: string[];
  title: string;
  body: string;
  metadata: Record<string, unknown>;
}): Promise<void> => {
  const uniqueUserIds = Array.from(new Set(params.userIds.filter((uid) => uid.trim().length > 0)));
  if (uniqueUserIds.length === 0) return;

  const db = getFirestore();
  const batch = db.batch();
  const notificationsRef = getCongregationRef(params.congregationId).collection('notifications');

  uniqueUserIds.forEach((userId) => {
    const notificationRef = notificationsRef.doc();
    batch.set(notificationRef, {
      notificationId: notificationRef.id,
      congregationId: params.congregationId,
      userId,
      type: 'billing',
      category: 'platform',
      title: params.title,
      body: params.body,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
      data: {
        url: '/(protected)/billing',
      },
      metadata: params.metadata,
    });
  });

  await batch.commit();
};

export const notifyPaymentFailed = async (
  congregationId: string,
  invoice: Record<string, unknown>
): Promise<void> => {
  const userIds = await getBillingReminderTargets(congregationId);
  await createBillingNotification({
    congregationId,
    userIds,
    title: 'Pago de OMP no procesado',
    body: 'No se pudo procesar el pago de OMP Suite. Actualiza el metodo de pago para evitar restricciones administrativas.',
    metadata: {
      billingEvent: 'invoice.payment_failed',
      invoiceId: asTrimmedString(invoice.id),
      invoiceUrl: getInvoiceUrl(invoice),
    },
  });
};

export const stripeWebhook = onRequest(
  { region: REGION, secrets: STRIPE_RUNTIME_SECRETS },
  async (request, response): Promise<void> => {
    if (request.method !== 'POST') {
      response.status(405).send('Method Not Allowed');
      return;
    }

    const stripe = getStripe();
    const signature = request.header('stripe-signature');
    if (!signature) {
      response.status(400).send('Missing Stripe signature');
      return;
    }

    let event: StripeWebhookEvent;
    try {
      event = stripe.webhooks.constructEvent(
        request.rawBody,
        signature,
        getSecret(STRIPE_WEBHOOK_SECRET)
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError('[billing] webhook signature verification failed', { congregationId: null }, error);
      response.status(400).send(`Webhook Error: ${message}`);
      return;
    }

    if (!MANAGED_EVENTS.has(event.type)) {
      response.json({ received: true, ignored: true });
      return;
    }

    // Idempotencia: reclamamos el evento de forma atomica antes de procesarlo,
    // para no manejarlo (ni notificar) dos veces ante reentregas de Stripe.
    const eventClaimRef = getFirestore().collection(WEBHOOK_EVENTS_COLLECTION).doc(event.id);
    let claim: WebhookClaimResult;
    try {
      claim = await claimWebhookEvent(eventClaimRef, event.type);
    } catch (error) {
      logError('[billing] webhook claim failed', { congregationId: null, eventId: event.id }, error);
      response.status(500).send('Webhook claim failed');
      return;
    }
    if (claim === 'duplicate') {
      logger.info('[billing] webhook duplicate ignored', {
        eventId: event.id,
        eventType: event.type,
      });
      response.json({ received: true, duplicate: true });
      return;
    }

    let congregationId: string | null = null;
    try {
      const eventObject = event.data.object as unknown as Record<string, unknown>;

      if (event.type === 'checkout.session.completed') {
        congregationId = await handleCheckoutCompleted(stripe, eventObject, event);
      } else if (
        event.type === 'customer.subscription.created' ||
        event.type === 'customer.subscription.updated' ||
        event.type === 'customer.subscription.deleted'
      ) {
        congregationId = await updateCongregationFromSubscription(eventObject, undefined, event);
      } else if (event.type === 'invoice.paid') {
        congregationId = await handleInvoiceStatus(eventObject, 'active', 'paid', event);
      } else if (event.type === 'invoice.payment_failed') {
        congregationId = await handleInvoiceStatus(eventObject, 'past_due', 'payment_failed', event);
        if (congregationId) {
          await notifyPaymentFailed(congregationId, eventObject);
        }
      } else if (event.type === 'invoice.payment_action_required') {
        congregationId = await handleInvoiceStatus(
          eventObject,
          'payment_action_required',
          'action_required',
          event
        );
        if (congregationId) {
          await notifyPaymentFailed(congregationId, eventObject);
        }
      }

      if (congregationId) {
        await writeBillingHistory(congregationId, event, eventObject);
      }

      await markWebhookEventProcessed(eventClaimRef);
      response.json({ received: true });
    } catch (error) {
      // Liberamos la reclamacion para que el reintento de Stripe vuelva a procesar
      // un evento que fallo a mitad de camino.
      await releaseWebhookEvent(eventClaimRef, event.id);
      logError('[billing] webhook processing failed', {
        congregationId,
        eventId: event.id,
        eventType: event.type,
      }, error);
      response.status(500).send('Webhook processing failed');
    }
  }
);

export const createBillingNotificationForSchedule = createBillingNotification;
