import Stripe from 'stripe';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { adminDb } from './config/firebaseAdmin.js';

type BillingPlanId = 'omp_80' | 'omp_150' | 'omp_250';
type ServicePosition = 'coordinador' | 'secretario' | 'encargado' | 'auxiliar' | string;
type ServiceDepartment = 'tesoreria' | string;

type RequesterProfile = {
  uid: string;
  email?: string;
  displayName?: string;
  role?: string;
  isActive?: boolean;
  congregationId?: string;
  servicePosition?: ServicePosition;
  serviceDepartment?: ServiceDepartment;
  serviceAssignments?: {
    position?: ServicePosition;
    department?: ServiceDepartment;
  }[];
  permissions?: Record<string, Record<string, boolean>>;
};

type BillingState = {
  enabled?: boolean;
  status?: string;
  billingDay?: number;
  billingCycle?: string;
  planId?: BillingPlanId;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodStart?: Timestamp | null;
  currentPeriodEnd?: Timestamp | null;
  nextPaymentDate?: Timestamp | null;
};

type CheckoutPayload = {
  congregationId?: string;
  plan?: BillingPlanId;
  successUrl?: string;
  cancelUrl?: string;
};

type PortalPayload = {
  congregationId?: string;
  returnUrl?: string;
};

const REGION = 'us-central1';
const BILLING_DAY = 1;
const BILLING_CYCLE = 'monthly';
const DEFAULT_SUCCESS_PATH = '/billing/success';
const DEFAULT_CANCEL_PATH = '/billing';
const MANAGED_EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
]);

const PLAN_PRICE_ENV: Record<BillingPlanId, string> = {
  omp_80: 'STRIPE_PRICE_OMP_80',
  omp_150: 'STRIPE_PRICE_OMP_150',
  omp_250: 'STRIPE_PRICE_OMP_250',
};

const PLAN_LIMITS: Record<BillingPlanId, number> = {
  omp_80: 80,
  omp_150: 150,
  omp_250: 250,
};

const getEnv = (key: string): string => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new HttpsError('failed-precondition', `Falta configurar ${key}.`);
  }
  return value;
};

const getStripe = () => new Stripe(getEnv('STRIPE_SECRET_KEY'));

const getPriceId = (plan: BillingPlanId): string => getEnv(PLAN_PRICE_ENV[plan]);

const isBillingPlanId = (value: unknown): value is BillingPlanId =>
  value === 'omp_80' || value === 'omp_150' || value === 'omp_250';

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const timestampFromSeconds = (seconds: unknown): Timestamp | null => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null;
  return Timestamp.fromMillis(seconds * 1000);
};

const toMillis = (value: unknown): number | null => {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    const maybeTimestamp = value as { toMillis?: unknown };
    if (typeof maybeTimestamp.toMillis === 'function') {
      const millis = maybeTimestamp.toMillis() as number;
      return Number.isFinite(millis) ? millis : null;
    }
  }
  return null;
};

const getNextFirstOfMonthUnix = (from = new Date()): number => {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  const firstOfThisMonth = Date.UTC(year, month, 1, 0, 0, 0, 0);
  const next =
    from.getTime() < firstOfThisMonth
      ? firstOfThisMonth
      : Date.UTC(year, month + 1, 1, 0, 0, 0, 0);
  return Math.floor(next / 1000);
};

const getDefaultUrl = (path: string): string => {
  const base =
    process.env.APP_BILLING_RETURN_URL?.trim() ||
    process.env.EXPO_PUBLIC_APP_URL?.trim() ||
    'https://ormeprassig-public.web.app';
  return `${base.replace(/\/$/, '')}${path}`;
};

const parseCheckoutPayload = (value: unknown): Required<CheckoutPayload> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', 'Solicitud de pago invalida.');
  }

  const source = value as Record<string, unknown>;
  const congregationId = asTrimmedString(source.congregationId);
  const plan = source.plan;

  if (!congregationId || !isBillingPlanId(plan)) {
    throw new HttpsError('invalid-argument', 'Se requiere congregacion y plan valido.');
  }

  return {
    congregationId,
    plan,
    successUrl: asTrimmedString(source.successUrl) ?? getDefaultUrl(DEFAULT_SUCCESS_PATH),
    cancelUrl: asTrimmedString(source.cancelUrl) ?? getDefaultUrl(DEFAULT_CANCEL_PATH),
  };
};

const parsePortalPayload = (value: unknown): Required<PortalPayload> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', 'Solicitud de portal invalida.');
  }

  const source = value as Record<string, unknown>;
  const congregationId = asTrimmedString(source.congregationId);
  if (!congregationId) {
    throw new HttpsError('invalid-argument', 'Se requiere congregationId.');
  }

  return {
    congregationId,
    returnUrl: asTrimmedString(source.returnUrl) ?? getDefaultUrl(DEFAULT_CANCEL_PATH),
  };
};

const normalizeRole = (value: unknown): string | undefined => {
  if (value === 'admin' || value === 'supervisor' || value === 'user') return value;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'administrador') return 'admin';
  if (normalized === 'usuario') return 'user';
  return undefined;
};

const getRequesterProfile = async (uid: string): Promise<RequesterProfile> => {
  const snap = await adminDb.collection('users').doc(uid).get();
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

const hasServiceAssignment = (
  profile: RequesterProfile,
  position: string,
  department?: string
): boolean =>
  Boolean(
    (
      profile.servicePosition === position &&
      (department === undefined || profile.serviceDepartment === department)
    ) ||
      profile.serviceAssignments?.some(
        (assignment) =>
          assignment.position === position &&
          (department === undefined || assignment.department === department)
      )
  );

const hasBillingPermission = (
  profile: RequesterProfile,
  action: 'create' | 'manage'
): boolean =>
  profile.permissions?.pagos?.[action] === true ||
  profile.permissions?.pagos?.manage === true;

const canOperateBilling = (profile: RequesterProfile): boolean =>
  hasServiceAssignment(profile, 'coordinador') ||
  hasServiceAssignment(profile, 'encargado', 'tesoreria') ||
  hasBillingPermission(profile, 'create') ||
  hasBillingPermission(profile, 'manage');

const assertBillingActor = async (
  uid: string,
  congregationId: string
): Promise<RequesterProfile> => {
  const profile = await getRequesterProfile(uid);
  if (profile.congregationId !== congregationId) {
    throw new HttpsError('permission-denied', 'No puedes gestionar pagos de otra congregacion.');
  }
  if (!canOperateBilling(profile)) {
    throw new HttpsError('permission-denied', 'Solo coordinador o tesorero puede gestionar cobros.');
  }
  return profile;
};

const getCongregationRef = (congregationId: string) =>
  adminDb.collection('congregations').doc(congregationId);

const readCongregation = async (congregationId: string) => {
  const ref = getCongregationRef(congregationId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Congregacion no encontrada.');
  }
  return { ref, data: snap.data() as Record<string, unknown> };
};

const isBillingExempt = (data: Record<string, unknown>): boolean => {
  const exemption = data.billingExemption;
  return Boolean(
    typeof exemption === 'object' &&
      exemption !== null &&
      (exemption as Record<string, unknown>).exempt === true
  );
};

const ensureStripeCustomer = async (params: {
  stripe: ReturnType<typeof getStripe>;
  congregationId: string;
  congregationData: Record<string, unknown>;
  requester: RequesterProfile;
}): Promise<string> => {
  const billing = params.congregationData.billing as BillingState | undefined;
  const existing = asTrimmedString(billing?.stripeCustomerId);
  if (existing) return existing;

  const name =
    asTrimmedString(params.congregationData.displayName) ??
    asTrimmedString(params.congregationData.name) ??
    params.congregationId;
  const customer = await params.stripe.customers.create({
    name,
    email: asTrimmedString(params.requester.email) ?? undefined,
    metadata: {
      congregationId: params.congregationId,
    },
  });
  return customer.id;
};

const resolveSubscriptionId = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return asTrimmedString((value as { id?: unknown }).id);
  }
  return null;
};

const resolveCustomerId = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return asTrimmedString((value as { id?: unknown }).id);
  }
  return null;
};

const priceToPlanId = (priceId: string | null): BillingPlanId | undefined => {
  if (!priceId) return undefined;
  return (Object.keys(PLAN_PRICE_ENV) as BillingPlanId[]).find(
    (plan) => process.env[PLAN_PRICE_ENV[plan]]?.trim() === priceId
  );
};

const getObjectMetadata = (value: unknown): Record<string, string> => {
  if (typeof value !== 'object' || value === null) return {};
  const metadata = (value as Record<string, unknown>).metadata;
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) return {};
  return Object.entries(metadata as Record<string, unknown>).reduce<Record<string, string>>(
    (acc, [key, item]) => {
      if (typeof item === 'string') acc[key] = item;
      return acc;
    },
    {}
  );
};

const getSubscriptionItems = (subscription: Record<string, unknown>): Record<string, unknown>[] => {
  const items = subscription.items;
  if (typeof items !== 'object' || items === null || !('data' in items)) return [];
  const data = (items as { data?: unknown }).data;
  return Array.isArray(data)
    ? data.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    : [];
};

const getSubscriptionPeriod = (subscription: Record<string, unknown>) => {
  const raw = subscription as unknown as Record<string, unknown>;
  const firstItem = getSubscriptionItems(subscription)[0];
  return {
    start:
      timestampFromSeconds(raw.current_period_start) ??
      timestampFromSeconds(firstItem?.current_period_start),
    end:
      timestampFromSeconds(raw.current_period_end) ??
      timestampFromSeconds(firstItem?.current_period_end),
  };
};

const subscriptionToBillingUpdate = (
  subscription: Record<string, unknown>,
  fallback?: Partial<BillingState>
): Record<string, unknown> => {
  const period = getSubscriptionPeriod(subscription);
  const price = getSubscriptionItems(subscription)[0]?.price;
  const priceId =
    typeof price === 'object' && price !== null
      ? asTrimmedString((price as Record<string, unknown>).id)
      : null;
  const planId = priceToPlanId(priceId) ?? fallback?.planId;
  const subscriptionId = asTrimmedString(subscription.id);

  return {
    'billing.enabled': true,
    'billing.status': asTrimmedString(subscription.status) ?? 'unknown',
    'billing.billingDay': BILLING_DAY,
    'billing.billingCycle': BILLING_CYCLE,
    'billing.planId': planId ?? null,
    'billing.activeUsersLimit': planId ? PLAN_LIMITS[planId] : null,
    'billing.stripeCustomerId': resolveCustomerId(subscription.customer),
    'billing.stripeSubscriptionId': subscriptionId,
    'billing.currentPeriodStart': period.start,
    'billing.currentPeriodEnd': period.end,
    'billing.nextPaymentDate': period.end,
    'billing.cancelAtPeriodEnd': subscription.cancel_at_period_end === true,
    'billing.updatedAt': FieldValue.serverTimestamp(),
  };
};

const updateCongregationFromSubscription = async (
  subscription: Record<string, unknown>,
  fallback?: Partial<BillingState> & { congregationId?: string }
): Promise<void> => {
  const congregationId =
    asTrimmedString(getObjectMetadata(subscription).congregationId) ??
    asTrimmedString(fallback?.congregationId);
  if (!congregationId) {
    logger.warn('[billing] subscription without congregationId metadata', {
      subscriptionId: subscription.id,
    });
    return;
  }

  await getCongregationRef(congregationId).set(subscriptionToBillingUpdate(subscription, fallback), {
    merge: true,
  });
};

const findCongregationBySubscription = async (
  subscriptionId: string
): Promise<string | null> => {
  const snap = await adminDb
    .collection('congregations')
    .where('billing.stripeSubscriptionId', '==', subscriptionId)
    .limit(1)
    .get();
  return snap.docs[0]?.id ?? null;
};

const handleCheckoutCompleted = async (
  stripe: ReturnType<typeof getStripe>,
  session: Record<string, unknown>
): Promise<void> => {
  const subscriptionId = resolveSubscriptionId(session.subscription);
  const metadata = getObjectMetadata(session);
  const congregationId = asTrimmedString(metadata.congregationId);
  if (!subscriptionId || !congregationId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price'],
  });
  await updateCongregationFromSubscription(
    subscription as unknown as Record<string, unknown>,
    {
      congregationId,
      planId: isBillingPlanId(metadata.plan) ? metadata.plan : undefined,
    }
  );
};

const handleInvoicePaid = async (invoice: Record<string, unknown>): Promise<void> => {
  const rawInvoice = invoice as unknown as Record<string, unknown>;
  const subscriptionId = resolveSubscriptionId(rawInvoice.subscription);
  if (!subscriptionId) return;
  const congregationId = await findCongregationBySubscription(subscriptionId);
  if (!congregationId) return;

  await getCongregationRef(congregationId).set(
    {
      'billing.status': 'active',
      'billing.lastPaymentAt': FieldValue.serverTimestamp(),
      'billing.lastInvoiceId': asTrimmedString(invoice.id),
      'billing.updatedAt': FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
};

const handleInvoicePaymentFailed = async (invoice: Record<string, unknown>): Promise<void> => {
  const rawInvoice = invoice as unknown as Record<string, unknown>;
  const subscriptionId = resolveSubscriptionId(rawInvoice.subscription);
  if (!subscriptionId) return;
  const congregationId = await findCongregationBySubscription(subscriptionId);
  if (!congregationId) return;

  await getCongregationRef(congregationId).set(
    {
      'billing.status': 'past_due',
      'billing.lastFailedPaymentAt': FieldValue.serverTimestamp(),
      'billing.lastInvoiceId': asTrimmedString(invoice.id),
      'billing.updatedAt': FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
};

export const createCheckoutSession = onCall(
  { region: REGION },
  async (request): Promise<{ url: string }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = parseCheckoutPayload(request.data);
    const requester = await assertBillingActor(request.auth.uid, payload.congregationId);
    const { ref, data } = await readCongregation(payload.congregationId);
    if (isBillingExempt(data)) {
      throw new HttpsError('failed-precondition', 'Esta congregacion esta exenta de cobro.');
    }

    const stripe = getStripe();
    const customerId = await ensureStripeCustomer({
      stripe,
      congregationId: payload.congregationId,
      congregationData: data,
      requester,
    });
    const anchor = getNextFirstOfMonthUnix();

    await ref.set(
      {
        billing: {
          enabled: true,
          status: 'checkout_pending',
          billingDay: BILLING_DAY,
          billingCycle: BILLING_CYCLE,
          planId: payload.plan,
          activeUsersLimit: PLAN_LIMITS[payload.plan],
          stripeCustomerId: customerId,
          updatedAt: FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: payload.congregationId,
      line_items: [
        {
          price: getPriceId(payload.plan),
          quantity: 1,
        },
      ],
      subscription_data: {
        billing_cycle_anchor: anchor,
        proration_behavior: 'create_prorations',
        metadata: {
          congregationId: payload.congregationId,
          plan: payload.plan,
        },
      },
      metadata: {
        congregationId: payload.congregationId,
        plan: payload.plan,
        requesterUid: requester.uid,
      },
      success_url: payload.successUrl,
      cancel_url: payload.cancelUrl,
    });

    if (!session.url) {
      throw new HttpsError('internal', 'Stripe no devolvio URL de Checkout.');
    }

    return { url: session.url };
  }
);

export const createBillingPortalSession = onCall(
  { region: REGION },
  async (request): Promise<{ url: string }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = parsePortalPayload(request.data);
    await assertBillingActor(request.auth.uid, payload.congregationId);
    const { data } = await readCongregation(payload.congregationId);
    if (isBillingExempt(data)) {
      throw new HttpsError('failed-precondition', 'Esta congregacion esta exenta de cobro.');
    }

    const billing = data.billing as BillingState | undefined;
    const customerId = asTrimmedString(billing?.stripeCustomerId);
    if (!customerId) {
      throw new HttpsError('failed-precondition', 'Esta congregacion aun no tiene cliente Stripe.');
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: payload.returnUrl,
    });

    return { url: session.url };
  }
);

export const stripeWebhook = onRequest(
  { region: REGION },
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

    let event: { type: string; data: { object: unknown } };
    try {
      event = stripe.webhooks.constructEvent(
        request.rawBody,
        signature,
        getEnv('STRIPE_WEBHOOK_SECRET')
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('[billing] webhook signature verification failed', { message });
      response.status(400).send(`Webhook Error: ${message}`);
      return;
    }

    if (!MANAGED_EVENTS.has(event.type)) {
      response.json({ received: true, ignored: true });
      return;
    }

    try {
      if (event.type === 'checkout.session.completed') {
        await handleCheckoutCompleted(stripe, event.data.object as Record<string, unknown>);
      } else if (
        event.type === 'customer.subscription.created' ||
        event.type === 'customer.subscription.updated' ||
        event.type === 'customer.subscription.deleted'
      ) {
        await updateCongregationFromSubscription(event.data.object as Record<string, unknown>);
      } else if (event.type === 'invoice.paid') {
        await handleInvoicePaid(event.data.object as Record<string, unknown>);
      } else if (event.type === 'invoice.payment_failed') {
        await handleInvoicePaymentFailed(event.data.object as Record<string, unknown>);
      }

      response.json({ received: true });
    } catch (error) {
      logger.error('[billing] webhook processing failed', {
        eventType: event.type,
        message: error instanceof Error ? error.message : String(error),
      });
      response.status(500).send('Webhook processing failed');
    }
  }
);

const getBillingReminderTargets = async (congregationId: string): Promise<string[]> => {
  const snap = await adminDb
    .collection('users')
    .where('congregationId', '==', congregationId)
    .where('isActive', '==', true)
    .limit(500)
    .get();

  return Array.from(
    new Set(
      snap.docs
        .map((doc) => ({ uid: doc.id, data: doc.data() as RequesterProfile }))
        .filter(({ data }) =>
          hasServiceAssignment(data, 'coordinador') ||
          hasServiceAssignment(data, 'encargado', 'tesoreria') ||
          hasServiceAssignment(data, 'auxiliar', 'tesoreria') ||
          data.permissions?.pagos?.view === true ||
          data.permissions?.pagos?.manage === true
        )
        .map(({ uid }) => uid)
    )
  );
};

const daysUntil = (targetMillis: number, now = new Date()): number => {
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const target = new Date(targetMillis);
  const targetUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return Math.ceil((targetUtc - todayUtc) / 86400000);
};

export const sendBillingPaymentReminders = onSchedule(
  {
    region: REGION,
    schedule: 'every day 08:00',
    timeZone: 'America/Mexico_City',
  },
  async () => {
    const snap = await adminDb
      .collection('congregations')
      .where('billing.enabled', '==', true)
      .limit(500)
      .get();
    let created = 0;

    for (const congregationDoc of snap.docs) {
      const data = congregationDoc.data() as Record<string, unknown>;
      if (isBillingExempt(data)) continue;

      const billing = data.billing as BillingState | undefined;
      const nextPaymentMillis = toMillis(billing?.nextPaymentDate);
      if (!nextPaymentMillis) continue;

      const days = daysUntil(nextPaymentMillis);
      if (days !== 5 && days !== 0) continue;

      const reminderKey = `${congregationDoc.id}:${new Date(nextPaymentMillis).toISOString().slice(0, 10)}:${days}`;
      const sentKeys = Array.isArray((billing as Record<string, unknown> | undefined)?.reminderKeys)
        ? ((billing as Record<string, unknown>).reminderKeys as unknown[])
        : [];
      if (sentKeys.includes(reminderKey)) continue;

      const userIds = await getBillingReminderTargets(congregationDoc.id);
      if (userIds.length === 0) continue;

      const notificationRef = adminDb
        .collection('congregations')
        .doc(congregationDoc.id)
        .collection('notifications')
        .doc();
      const title = days === 5 ? 'Pago proximo de OMP' : 'Pago de OMP vence hoy';
      const body =
        days === 5
          ? 'Faltan 5 dias para el proximo pago de la congregacion.'
          : 'El pago de la congregacion vence hoy.';

      await notificationRef.set({
        notificationId: notificationRef.id,
        congregationId: congregationDoc.id,
        userId: userIds[0],
        userIds,
        type: 'billing',
        category: 'platform',
        title,
        body,
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
        data: {
          url: '/(protected)/billing',
        },
        metadata: {
          billingReminder: true,
          daysUntilPayment: days,
          nextPaymentDate: new Date(nextPaymentMillis).toISOString(),
        },
      });
      await congregationDoc.ref.set(
        {
          'billing.reminderKeys': FieldValue.arrayUnion(reminderKey),
          'billing.updatedAt': FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      created += 1;
    }

    logger.info('[billing] payment reminders processed', { created });
  }
);
