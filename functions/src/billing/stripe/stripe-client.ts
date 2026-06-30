import Stripe from 'stripe';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError } from 'firebase-functions/v2/https';

export type BillingPlanKey = 'omp_80' | 'omp_150' | 'omp_250';

export const REGION = 'us-central1';
export const BILLING_DAY = 1;
export const BILLING_CYCLE = 'monthly';
export const GRACE_DAYS = 5;
export const BILLING_HISTORY_COLLECTION = 'billingHistory';
export const BILLING_HISTORY_RETENTION_DAYS = 365;

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
export const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
const STRIPE_PRICE_OMP_80 = defineSecret('STRIPE_PRICE_OMP_80');
const STRIPE_PRICE_OMP_150 = defineSecret('STRIPE_PRICE_OMP_150');
const STRIPE_PRICE_OMP_250 = defineSecret('STRIPE_PRICE_OMP_250');
const APP_BILLING_RETURN_URL = defineSecret('APP_BILLING_RETURN_URL');

export const STRIPE_RUNTIME_SECRETS = [
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_OMP_80,
  STRIPE_PRICE_OMP_150,
  STRIPE_PRICE_OMP_250,
  APP_BILLING_RETURN_URL,
];

const PLAN_PRICE_SECRETS: Record<BillingPlanKey, typeof STRIPE_PRICE_OMP_80> = {
  omp_80: STRIPE_PRICE_OMP_80,
  omp_150: STRIPE_PRICE_OMP_150,
  omp_250: STRIPE_PRICE_OMP_250,
};

export const PLAN_LIMITS: Record<BillingPlanKey, number> = {
  omp_80: 80,
  omp_150: 150,
  omp_250: 250,
};

export const PLAN_PRICES_MXN: Record<BillingPlanKey, number> = {
  omp_80: 70,
  omp_150: 120,
  omp_250: 200,
};

export const getSecret = (secret: { name: string; value: () => string }): string => {
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

export const getStripe = () =>
  new Stripe(getSecret(STRIPE_SECRET_KEY), { apiVersion: STRIPE_API_VERSION });

export const getPriceId = (planKey: BillingPlanKey): string =>
  getSecret(PLAN_PRICE_SECRETS[planKey]);

export const priceToPlanKey = (priceId: string | null): BillingPlanKey | undefined => {
  if (!priceId) return undefined;
  return (Object.keys(PLAN_PRICE_SECRETS) as BillingPlanKey[]).find(
    (planKey) => getSecret(PLAN_PRICE_SECRETS[planKey]) === priceId
  );
};

export const isBillingPlanKey = (value: unknown): value is BillingPlanKey =>
  value === 'omp_80' || value === 'omp_150' || value === 'omp_250';

export const getNextFirstOfMonthUnix = (from = new Date()): number => {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  const firstOfThisMonth = Date.UTC(year, month, 1, 0, 0, 0, 0);
  const next =
    from.getTime() < firstOfThisMonth
      ? firstOfThisMonth
      : Date.UTC(year, month + 1, 1, 0, 0, 0, 0);
  return Math.floor(next / 1000);
};

export const getDefaultUrl = (path: string): string => {
  const base = getSecret(APP_BILLING_RETURN_URL);
  return `${base.replace(/\/$/, '')}${path}`;
};
