import Stripe from 'stripe';

import { getInvoiceSubscriptionId } from '../billing/stripe/billing-state.js';

describe('Stripe invoice subscription reference', () => {
  it.each([
    [{ subscription: 'sub_legacy' }, 'sub_legacy'],
    [{ subscription: { id: 'sub_old_expanded' } }, 'sub_old_expanded'],
    [{ parent: { subscription_details: { subscription: 'sub_endive' } } }, 'sub_endive'],
    [{ parent: { subscription_details: { subscription: { id: 'sub_expanded' } } } }, 'sub_expanded'],
    [{ id: 'in_unrelated', parent: { subscription_details: null } }, null],
  ])('uses the subscription reference from %j', (invoice, expected) => {
    expect(getInvoiceSubscriptionId(invoice)).toBe(expected);
  });
});

it('reads the Endive subscription from a signature-verified Stripe webhook', () => {
  const stripe = new Stripe('sk_test_synthetic', { apiVersion: '2026-10-28.endive' });
  const secret = 'whsec_omp_synthetic';
  const payload = JSON.stringify({
    id: 'evt_demo',
    api_version: '2026-10-28.endive',
    type: 'invoice.paid',
    data: {
      object: {
        id: 'in_demo',
        parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_demo' } },
      },
    },
  });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const event = stripe.webhooks.constructEvent(payload, header, secret);

  expect(event.type).toBe('invoice.paid');
  expect(getInvoiceSubscriptionId(event.data.object as unknown as Record<string, unknown>))
    .toBe('sub_demo');
  expect(() => stripe.webhooks.constructEvent(payload, header, 'different_secret')).toThrow();
});
