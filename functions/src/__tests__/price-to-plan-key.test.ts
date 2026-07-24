const secretValues: Record<string, string> = {};

jest.mock('firebase-functions/params', () => ({
  defineSecret: (name: string) => ({
    name,
    value: () => secretValues[name] ?? '',
  }),
}));

import { priceToPlanKey } from '../billing/stripe/stripe-client.js';

const setSecrets = (values: Record<string, string>): void => {
  Object.keys(secretValues).forEach((key) => delete secretValues[key]);
  Object.assign(secretValues, values);
};

const ALL_CONFIGURED = {
  STRIPE_PRICE_OMP_80: 'price_80',
  STRIPE_PRICE_OMP_150: 'price_150',
  STRIPE_PRICE_OMP_250: 'price_250',
};

describe('priceToPlanKey', () => {
  beforeEach(() => {
    setSecrets(ALL_CONFIGURED);
  });

  it('returns undefined for a null price id', () => {
    expect(priceToPlanKey(null)).toBeUndefined();
  });

  it('returns undefined for an empty price id', () => {
    expect(priceToPlanKey('')).toBeUndefined();
  });

  it('returns the matching plan key', () => {
    expect(priceToPlanKey('price_150')).toBe('omp_150');
  });

  it('returns undefined for an unknown price id', () => {
    expect(priceToPlanKey('price_desconocido')).toBeUndefined();
  });

  // Regresion del PR 5. Sin el try/catch dentro del find, este caso lanza
  // HttpsError('failed-precondition') en vez de devolver 'omp_250'.
  it('continues matching when an earlier price secret is empty', () => {
    setSecrets({
      STRIPE_PRICE_OMP_80: '',
      STRIPE_PRICE_OMP_150: 'price_150',
      STRIPE_PRICE_OMP_250: 'price_250',
    });

    expect(priceToPlanKey('price_250')).toBe('omp_250');
  });

  it('does not throw when all price secrets are empty', () => {
    setSecrets({});

    expect(() => priceToPlanKey('price_150')).not.toThrow();
  });

  it('returns undefined when all price secrets are empty', () => {
    setSecrets({});

    expect(priceToPlanKey('price_150')).toBeUndefined();
  });
});
