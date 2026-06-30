import {
  FieldValue,
  Timestamp,
  getFirestore,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { HttpsError } from 'firebase-functions/v2/https';

import {
  BILLING_CYCLE,
  BILLING_DAY,
  GRACE_DAYS,
  PLAN_LIMITS,
  isBillingPlanKey,
  priceToPlanKey,
  type BillingPlanKey,
} from './stripe-client.js';

export type BillingState = {
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

export type CheckoutPayload = {
  congregationId?: string;
  planKey?: BillingPlanKey;
};

export type PortalPayload = {
  congregationId?: string;
};

export type StripeWebhookEvent = {
  id: string;
  type: string;
  created: number;
  data: {
    object: unknown;
  };
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

export const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const timestampFromSeconds = (seconds: unknown): Timestamp | null => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null;
  return Timestamp.fromMillis(seconds * 1000);
};

export const timestampFromMillis = (millis: number): Timestamp =>
  Timestamp.fromMillis(Math.max(0, Math.floor(millis)));

export const toMillis = (value: unknown): number | null => {
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

export const getEventTimestamp = (event?: Pick<StripeWebhookEvent, 'created'>): Timestamp =>
  timestampFromSeconds(event?.created) ?? Timestamp.now();

const isTimestampInFuture = (value: unknown): boolean => {
  const millis = toMillis(value);
  return millis === null || millis > Date.now();
};

export const parseCheckoutPayload = (value: unknown): Required<CheckoutPayload> => {
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

export const parsePortalPayload = (value: unknown): Required<PortalPayload> => {
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

export const getCongregationRef = (congregationId: string) =>
  getFirestore().collection('congregations').doc(congregationId);

export const readCongregation = async (congregationId: string) => {
  const ref = getCongregationRef(congregationId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Congregacion no encontrada.');
  }
  return { ref, data: snap.data() as Record<string, unknown> };
};

export const isBillingExempt = (data: Record<string, unknown>): boolean => {
  const exemption = data.billingExemption;
  return Boolean(
    typeof exemption === 'object' &&
      exemption !== null &&
      (exemption as Record<string, unknown>).exempt === true &&
      isTimestampInFuture((exemption as Record<string, unknown>).expiresAt)
  );
};

export const getBillingAccessUpdate = (
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

export const resolveSubscriptionId = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return asTrimmedString((value as { id?: unknown }).id);
  }
  return null;
};

export const resolveCustomerId = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return asTrimmedString((value as { id?: unknown }).id);
  }
  return null;
};

export const listActiveUserDocsForCongregation = async (
  congregationId: string
): Promise<QueryDocumentSnapshot[]> => {
  const docs: QueryDocumentSnapshot[] = [];
  let lastDoc: QueryDocumentSnapshot | undefined;

  while (true) {
    let query = getFirestore()
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

export const listBillingEnabledCongregationDocs = async (): Promise<QueryDocumentSnapshot[]> => {
  const docs: QueryDocumentSnapshot[] = [];
  let lastDoc: QueryDocumentSnapshot | undefined;

  while (true) {
    let query = getFirestore()
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

export const getObjectMetadata = (value: unknown): Record<string, string> => {
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

export const getSubscriptionItems = (
  subscription: Record<string, unknown>
): Record<string, unknown>[] => {
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

export const updateCongregationFromSubscription = async (
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

export const findCongregationBySubscription = async (
  subscriptionId: string
): Promise<string | null> => {
  const snap = await getFirestore()
    .collection('congregations')
    .where('billing.stripeSubscriptionId', '==', subscriptionId)
    .limit(1)
    .get();
  return snap.docs[0]?.id ?? null;
};

export const getInvoiceUrl = (invoice: Record<string, unknown>): string | null =>
  asTrimmedString(invoice.hosted_invoice_url) ?? asTrimmedString(invoice.invoice_pdf);
