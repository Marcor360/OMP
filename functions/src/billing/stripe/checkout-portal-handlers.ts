import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import {
  assertBillingActor,
  assertBillingViewer,
  type RequesterProfile,
} from './authorization.js';
import {
  asTrimmedString,
  isBillingExempt,
  parseCheckoutPayload,
  parsePortalPayload,
  readCongregation,
  type BillingState,
} from './billing-state.js';
import {
  BILLING_CYCLE,
  BILLING_DAY,
  GRACE_DAYS,
  PLAN_LIMITS,
  PLAN_PRICES_MXN,
  REGION,
  STRIPE_RUNTIME_SECRETS,
  getDefaultUrl,
  getNextFirstOfMonthUnix,
  getPriceId,
  getStripe,
} from './stripe-client.js';

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

export const getStripeBillingUsage = onCall(
  { region: REGION },
  async (request): Promise<{ activeUsersCount: number }> => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');
    }
    const payload = parsePortalPayload(request.data);
    await assertBillingViewer(request.auth.uid, payload.congregationId);

    const snap = await getFirestore()
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
