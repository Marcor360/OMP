import Stripe from 'stripe';
import { FieldValue, Timestamp, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { adminDb } from '../config/firebaseAdmin.js';
import {
  claimWebhookEvent,
  markWebhookEventProcessed,
  releaseWebhookEvent,
  WEBHOOK_EVENTS_COLLECTION,
  type WebhookClaimResult,
} from './webhook-idempotency.js';

type BillingPlanKey = 'omp_80' | 'omp_150' | 'omp_250';
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
  provider?: string;
  status?: string;
  billingDay?: number;
  billingCycle?: string;
  planKey?: BillingPlanKey;
  activeUsersLimit?: number;
  userLimit?: number;
  stripePriceId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodStart?: Timestamp | null;
  currentPeriodEnd?: Timestamp | null;
  nextPaymentDate?: Timestamp | null;
  graceDays?: number;
  graceStartedAt?: Timestamp | null;
  graceUntil?: Timestamp | null;
  adminRestricted?: boolean;
  lastPaymentStatus?: string;
  lastInvoiceId?: string;
  lastInvoiceUrl?: string | null;
  lastStripeEventId?: string;
};

type CheckoutPayload = {
  congregationId?: string;
  planKey?: BillingPlanKey;
};

type PortalPayload = {
  congregationId?: string;
};

type StripeWebhookEvent = {
  id: string;
  type: string;
  created: number;
  data: {
    object: unknown;
  };
};

const REGION = 'us-central1';
const BILLING_DAY = 1;
const BILLING_CYCLE = 'monthly';
const GRACE_DAYS = 5;
const BILLING_HISTORY_COLLECTION = 'billingHistory';
const BILLING_HISTORY_RETENTION_DAYS = 365;
const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
const STRIPE_PRICE_OMP_80 = defineSecret('STRIPE_PRICE_OMP_80');
const STRIPE_PRICE_OMP_150 = defineSecret('STRIPE_PRICE_OMP_150');
const STRIPE_PRICE_OMP_250 = defineSecret('STRIPE_PRICE_OMP_250');
const APP_BILLING_RETURN_URL = defineSecret('APP_BILLING_RETURN_URL');
const STRIPE_RUNTIME_SECRETS = [
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_OMP_80,
  STRIPE_PRICE_OMP_150,
  STRIPE_PRICE_OMP_250,
  APP_BILLING_RETURN_URL,
];
const MANAGED_EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_action_required',
]);

const PLAN_PRICE_SECRETS: Record<BillingPlanKey, typeof STRIPE_PRICE_OMP_80> = {
  omp_80: STRIPE_PRICE_OMP_80,
  omp_150: STRIPE_PRICE_OMP_150,
  omp_250: STRIPE_PRICE_OMP_250,
};

const PLAN_LIMITS: Record<BillingPlanKey, number> = {
  omp_80: 80,
  omp_150: 150,
  omp_250: 250,
};

const PLAN_PRICES_MXN: Record<BillingPlanKey, number> = {
  omp_80: 70,
  omp_150: 120,
  omp_250: 200,
};

const GRACE_BILLING_STATUSES = new Set([
  'past_due',
  'payment_action_required',
  'incomplete',
]);

const RESTRICTED_BILLING_STATUSES = new Set([
  'unpaid',
  'canceled',
  'incomplete_expired',
]);

const OPEN_BILLING_STATUSES = new Set(['active', 'trialing', 'checkout_pending']);
const BILLING_SCAN_PAGE_SIZE = 200;

const getSecret = (secret: { name: string; value: () => string }): string => {
  const value = secret.value().trim();
  if (!value) {
    throw new HttpsError('failed-precondition', `Falta configurar ${secret.name}.`);
  }
  return value;
};

// Fijamos apiVersion al literal del SDK instalado para evitar cambios de
// comportamiento silenciosos si la version por defecto de la cuenta Stripe cambia.
// Si un upgrade del SDK retira este literal, el typecheck fallara en `new Stripe(...)`
// de abajo, forzando revisar el pin de forma consciente.
const STRIPE_API_VERSION = '2026-05-27.dahlia';
const getStripe = () => new Stripe(getSecret(STRIPE_SECRET_KEY), { apiVersion: STRIPE_API_VERSION });

const getPriceId = (planKey: BillingPlanKey): string => getSecret(PLAN_PRICE_SECRETS[planKey]);

const isBillingPlanKey = (value: unknown): value is BillingPlanKey =>
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

const timestampFromMillis = (millis: number): Timestamp =>
  Timestamp.fromMillis(Math.max(0, Math.floor(millis)));

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

const addDays = (timestamp: Timestamp, days: number): Timestamp =>
  Timestamp.fromMillis(timestamp.toMillis() + days * 86400000);

const getEventTimestamp = (event?: Pick<StripeWebhookEvent, 'created'>): Timestamp =>
  timestampFromSeconds(event?.created) ?? Timestamp.now();

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
  const base = getSecret(APP_BILLING_RETURN_URL);
  return `${base.replace(/\/$/, '')}${path}`;
};

const isTimestampInFuture = (value: unknown): boolean => {
  const millis = toMillis(value);
  return millis === null || millis > Date.now();
};

const parseCheckoutPayload = (value: unknown): Required<CheckoutPayload> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', 'Solicitud de pago invalida.');
  }

  const source = value as Record<string, unknown>;
  const congregationId = asTrimmedString(source.congregationId);
  const planKey = source.planKey;

  if (!congregationId || !isBillingPlanKey(planKey)) {
    throw new HttpsError('invalid-argument', 'Se requiere congregacion y plan valido.');
  }

  return {
    congregationId,
    planKey,
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

const isAdminRole = (profile: RequesterProfile): boolean => profile.role === 'admin';

const hasBillingPermission = (
  profile: RequesterProfile,
  action: 'view' | 'create' | 'manage'
): boolean =>
  profile.permissions?.pagos?.[action] === true ||
  profile.permissions?.pagos?.manage === true;

const hasTreasuryManagerAssignment = (profile: RequesterProfile): boolean =>
  hasServiceAssignment(profile, 'encargado', 'tesoreria');

const hasAssistantTreasuryAssignment = (profile: RequesterProfile): boolean =>
  hasServiceAssignment(profile, 'auxiliar', 'tesoreria');

const hasCoordinatorOrSecretaryAssignment = (profile: RequesterProfile): boolean =>
  hasServiceAssignment(profile, 'coordinador') || hasServiceAssignment(profile, 'secretario');

const canOperateBilling = (profile: RequesterProfile): boolean =>
  hasCoordinatorOrSecretaryAssignment(profile) ||
  hasTreasuryManagerAssignment(profile) ||
  (
    hasAssistantTreasuryAssignment(profile) &&
    (hasBillingPermission(profile, 'create') || hasBillingPermission(profile, 'manage'))
  ) ||
  hasBillingPermission(profile, 'create') ||
  hasBillingPermission(profile, 'manage');

const canViewBilling = (profile: RequesterProfile): boolean =>
  isAdminRole(profile) ||
  canOperateBilling(profile) ||
  hasAssistantTreasuryAssignment(profile) ||
  profile.permissions?.pagos?.view === true;

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

const assertBillingViewer = async (
  uid: string,
  congregationId: string
): Promise<RequesterProfile> => {
  const profile = await getRequesterProfile(uid);
  if (profile.congregationId !== congregationId) {
    throw new HttpsError('permission-denied', 'No puedes ver pagos de otra congregacion.');
  }
  if (!canViewBilling(profile)) {
    throw new HttpsError('permission-denied', 'No tienes permiso para ver facturacion.');
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
      (exemption as Record<string, unknown>).exempt === true &&
      isTimestampInFuture((exemption as Record<string, unknown>).expiresAt)
  );
};

const getBillingAccessUpdate = (
  status: string | null | undefined,
  existingBilling?: BillingState,
  eventTimestamp = Timestamp.now()
): Record<string, unknown> => {
  const normalizedStatus = status ?? 'unknown';

  if (OPEN_BILLING_STATUSES.has(normalizedStatus)) {
    return {
      'billing.graceDays': GRACE_DAYS,
      'billing.graceStartedAt': null,
      'billing.graceUntil': null,
      'billing.adminRestricted': false,
    };
  }

  if (GRACE_BILLING_STATUSES.has(normalizedStatus)) {
    const existingGraceUntil = existingBilling?.graceUntil;
    const graceUntil =
      existingGraceUntil instanceof Timestamp && existingGraceUntil.toMillis() > eventTimestamp.toMillis()
        ? existingGraceUntil
        : addDays(eventTimestamp, GRACE_DAYS);

    return {
      'billing.graceDays': GRACE_DAYS,
      'billing.graceStartedAt': existingBilling?.graceStartedAt ?? eventTimestamp,
      'billing.graceUntil': graceUntil,
      'billing.adminRestricted': graceUntil.toMillis() <= Date.now(),
    };
  }

  if (RESTRICTED_BILLING_STATUSES.has(normalizedStatus)) {
    return {
      'billing.graceDays': GRACE_DAYS,
      'billing.adminRestricted': true,
    };
  }

  return {
    'billing.graceDays': GRACE_DAYS,
  };
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

const priceToPlanKey = (priceId: string | null): BillingPlanKey | undefined => {
  if (!priceId) return undefined;
  return (Object.keys(PLAN_PRICE_SECRETS) as BillingPlanKey[]).find(
    (planKey) => getSecret(PLAN_PRICE_SECRETS[planKey]) === priceId
  );
};

const listActiveUserDocsForCongregation = async (
  congregationId: string
): Promise<QueryDocumentSnapshot[]> => {
  const docs: QueryDocumentSnapshot[] = [];
  let lastDoc: QueryDocumentSnapshot | undefined;

  while (true) {
    let query = adminDb
      .collection('users')
      .where('congregationId', '==', congregationId)
      .where('isActive', '==', true)
      .orderBy('__name__')
      .limit(BILLING_SCAN_PAGE_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snap = await query.get();
    docs.push(...snap.docs);

    if (snap.size < BILLING_SCAN_PAGE_SIZE) {
      break;
    }

    lastDoc = snap.docs[snap.docs.length - 1];
  }

  return docs;
};

const listBillingEnabledCongregationDocs = async (): Promise<QueryDocumentSnapshot[]> => {
  const docs: QueryDocumentSnapshot[] = [];
  let lastDoc: QueryDocumentSnapshot | undefined;

  while (true) {
    let query = adminDb
      .collection('congregations')
      .where('billing.enabled', '==', true)
      .orderBy('__name__')
      .limit(BILLING_SCAN_PAGE_SIZE);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snap = await query.get();
    docs.push(...snap.docs);

    if (snap.size < BILLING_SCAN_PAGE_SIZE) {
      break;
    }

    lastDoc = snap.docs[snap.docs.length - 1];
  }

  return docs;
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
  fallback?: Partial<BillingState>,
  existingBilling?: BillingState,
  event?: Pick<StripeWebhookEvent, 'id' | 'created'>
): Record<string, unknown> => {
  const period = getSubscriptionPeriod(subscription);
  const price = getSubscriptionItems(subscription)[0]?.price;
  const priceId =
    typeof price === 'object' && price !== null
      ? asTrimmedString((price as Record<string, unknown>).id)
      : null;
  const metadataPlanKey = getObjectMetadata(subscription).planKey;
  const planKey =
    priceToPlanKey(priceId) ??
    (isBillingPlanKey(metadataPlanKey) ? metadataPlanKey : undefined) ??
    fallback?.planKey;
  const subscriptionId = asTrimmedString(subscription.id);
  const status = asTrimmedString(subscription.status) ?? 'unknown';
  const planLimit = planKey ? PLAN_LIMITS[planKey] : null;

  return {
    'billing.enabled': true,
    'billing.provider': 'stripe',
    'billing.status': status,
    'billing.billingDay': BILLING_DAY,
    'billing.billingCycle': BILLING_CYCLE,
    'billing.planKey': planKey ?? null,
    'billing.activeUsersLimit': planLimit,
    'billing.userLimit': planLimit,
    'billing.stripePriceId': priceId,
    'billing.stripeCustomerId': resolveCustomerId(subscription.customer),
    'billing.stripeSubscriptionId': subscriptionId,
    'billing.currentPeriodStart': period.start,
    'billing.currentPeriodEnd': period.end,
    'billing.nextPaymentDate': period.end,
    'billing.cancelAtPeriodEnd': subscription.cancel_at_period_end === true,
    'billing.lastStripeEventId': event?.id ?? fallback?.lastStripeEventId ?? null,
    'billing.updatedAt': FieldValue.serverTimestamp(),
    ...getBillingAccessUpdate(status, existingBilling, getEventTimestamp(event)),
  };
};

const updateCongregationFromSubscription = async (
  subscription: Record<string, unknown>,
  fallback?: Partial<BillingState> & { congregationId?: string },
  event?: Pick<StripeWebhookEvent, 'id' | 'created'>
): Promise<string | null> => {
  const congregationId =
    asTrimmedString(getObjectMetadata(subscription).congregationId) ??
    asTrimmedString(fallback?.congregationId);
  if (!congregationId) {
    logger.warn('[billing] subscription without congregationId metadata', {
      subscriptionId: subscription.id,
    });
    return null;
  }

  const ref = getCongregationRef(congregationId);
  const snap = await ref.get();
  const existingBilling = snap.exists
    ? ((snap.data() as Record<string, unknown>).billing as BillingState | undefined)
    : undefined;

  await ref.set(
    subscriptionToBillingUpdate(subscription, fallback, existingBilling, event),
    { merge: true }
  );

  return congregationId;
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

const getInvoiceUrl = (invoice: Record<string, unknown>): string | null =>
  asTrimmedString(invoice.hosted_invoice_url) ?? asTrimmedString(invoice.invoice_pdf);

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
        stripeCustomerId: getInvoiceCustomerId(object) ?? resolveCustomerId(object.customer) ?? currentBilling?.stripeCustomerId ?? null,
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

  const batch = adminDb.batch();
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

const notifyPaymentFailed = async (
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

export const getStripeBillingUsage = onCall(
  { region: REGION },
  async (request): Promise<{ activeUsersCount: number }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }
    const payload = parsePortalPayload(request.data);
    await assertBillingViewer(request.auth.uid, payload.congregationId);

    const snap = await adminDb
      .collection('users')
      .where('congregationId', '==', payload.congregationId)
      .where('isActive', '==', true)
      .count()
      .get();

    return { activeUsersCount: snap.data().count };
  }
);

export const createStripeCheckoutSession = onCall(
  { region: REGION, secrets: STRIPE_RUNTIME_SECRETS },
  async (request): Promise<{ url: string }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = parseCheckoutPayload(request.data);
    const requester = await assertBillingActor(request.auth.uid, payload.congregationId);
    const { ref, data } = await readCongregation(payload.congregationId);
    if (isBillingExempt(data)) {
      await ref.set(
        {
          billing: {
            enabled: true,
            provider: 'exempt',
            status: 'exempt',
            billingDay: BILLING_DAY,
            billingCycle: BILLING_CYCLE,
            graceDays: GRACE_DAYS,
            adminRestricted: false,
            updatedAt: FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );
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
          provider: 'stripe',
          status: 'checkout_pending',
          billingDay: BILLING_DAY,
          billingCycle: BILLING_CYCLE,
          planKey: payload.planKey,
          activeUsersLimit: PLAN_LIMITS[payload.planKey],
          userLimit: PLAN_LIMITS[payload.planKey],
          graceDays: GRACE_DAYS,
          adminRestricted: false,
          stripePriceId: getPriceId(payload.planKey),
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
          price: getPriceId(payload.planKey),
          quantity: 1,
        },
      ],
      subscription_data: {
        billing_cycle_anchor: anchor,
        proration_behavior: 'create_prorations',
        metadata: {
          congregationId: payload.congregationId,
          planKey: payload.planKey,
          activeUsersLimit: String(PLAN_LIMITS[payload.planKey]),
          monthlyPriceMxn: String(PLAN_PRICES_MXN[payload.planKey]),
        },
      },
      metadata: {
        congregationId: payload.congregationId,
        planKey: payload.planKey,
        requesterUid: requester.uid,
      },
      success_url: getDefaultUrl('/success'),
      cancel_url: getDefaultUrl('/cancel'),
    });

    if (!session.url) {
      throw new HttpsError('internal', 'Stripe no devolvio URL de Checkout.');
    }

    return { url: session.url };
  }
);

export const createStripePortalSession = onCall(
  { region: REGION, secrets: STRIPE_RUNTIME_SECRETS },
  async (request): Promise<{ url: string }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }

    const payload = parsePortalPayload(request.data);
    await assertBillingActor(request.auth.uid, payload.congregationId);
    const { ref, data } = await readCongregation(payload.congregationId);
    if (isBillingExempt(data)) {
      await ref.set(
        {
          billing: {
            enabled: true,
            provider: 'exempt',
            status: 'exempt',
            graceDays: GRACE_DAYS,
            adminRestricted: false,
            updatedAt: FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );
      throw new HttpsError('failed-precondition', 'Esta congregacion esta exenta de cobro.');
    }

    const billing = data.billing as BillingState | undefined;
    const customerId = asTrimmedString(billing?.stripeCustomerId);
    if (!customerId) {
      throw new HttpsError('failed-precondition', 'Esta congregacion aun no tiene cliente Stripe.');
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: getDefaultUrl(''),
    });

    return { url: session.url };
  }
);

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
      logger.error('[billing] webhook signature verification failed', { message });
      response.status(400).send(`Webhook Error: ${message}`);
      return;
    }

    if (!MANAGED_EVENTS.has(event.type)) {
      response.json({ received: true, ignored: true });
      return;
    }

    // Idempotencia: reclamamos el evento de forma atomica antes de procesarlo,
    // para no manejarlo (ni notificar) dos veces ante reentregas de Stripe.
    const eventClaimRef = adminDb.collection(WEBHOOK_EVENTS_COLLECTION).doc(event.id);
    let claim: WebhookClaimResult;
    try {
      claim = await claimWebhookEvent(eventClaimRef, event.type);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('[billing] webhook claim failed', { eventId: event.id, message });
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

    try {
      let congregationId: string | null = null;
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
      logger.error('[billing] webhook processing failed', {
        eventType: event.type,
        message: error instanceof Error ? error.message : String(error),
      });
      response.status(500).send('Webhook processing failed');
    }
  }
);

const getBillingReminderTargets = async (congregationId: string): Promise<string[]> => {
  const docs = await listActiveUserDocsForCongregation(congregationId);

  return Array.from(
    new Set(
      docs
        .map((doc) => ({ uid: doc.id, data: doc.data() as RequesterProfile }))
        .filter(({ data }) =>
          isAdminRole(data) ||
          hasCoordinatorOrSecretaryAssignment(data) ||
          hasTreasuryManagerAssignment(data) ||
          hasAssistantTreasuryAssignment(data) ||
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
    const congregationDocs = await listBillingEnabledCongregationDocs();
    let created = 0;

    for (const congregationDoc of congregationDocs) {
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

      const title = days === 5 ? 'Pago proximo de OMP' : 'Pago de OMP vence hoy';
      const body =
        days === 5
          ? 'Se aproxima la fecha de cobro de OMP Suite para tu congregacion. El pago mensual se realizara el dia 1.'
          : 'El pago mensual de OMP Suite vence hoy.';

      await createBillingNotification({
        congregationId: congregationDoc.id,
        userIds,
        title,
        body,
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

export const scheduledBillingHistoryCleanup = onSchedule(
  {
    region: REGION,
    schedule: 'every day 03:30',
    timeZone: 'America/Mexico_City',
    timeoutSeconds: 300,
    memory: '256MiB',
  },
  async () => {
    const cutoff = timestampFromMillis(
      Date.now() - BILLING_HISTORY_RETENTION_DAYS * 86400000
    );
    const snap = await adminDb
      .collectionGroup(BILLING_HISTORY_COLLECTION)
      .where('createdAt', '<', cutoff)
      .orderBy('createdAt', 'asc')
      .limit(250)
      .get();

    if (snap.empty) {
      logger.info('[billing] history cleanup skipped; no expired records');
      return;
    }

    const batch = adminDb.batch();
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();

    logger.info('[billing] history cleanup completed', {
      deleted: snap.size,
    });
  }
);
