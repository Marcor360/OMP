/**
 * Pruebas unitarias — assertAdministrativeBillingAccess (SEC-05)
 *
 * Esta funcion es el guard que ahora bloquea 17 callables administrativos
 * cuando la suscripcion Stripe de la congregacion esta restringida. Se prueba
 * una sola vez aqui, contra la implementacion real (Firestore mockeado), en
 * vez de espejar su rama en cada archivo de callable -- un espejo copiado 17
 * veces puede divergir en silencio si la implementacion cambia.
 */

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(),
}));

import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

import { assertAdministrativeBillingAccess } from '../users/authorization.js';

const mockGetFirestore = getFirestore as jest.Mock;

const buildDb = (congregationData: Record<string, unknown> | null) => {
  const docRef = {
    get: jest.fn().mockResolvedValue({
      exists: congregationData !== null,
      data: () => congregationData ?? undefined,
    }),
  };
  const collection = { doc: jest.fn(() => docRef) };
  return { collection: jest.fn(() => collection) };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('assertAdministrativeBillingAccess', () => {
  it('does not throw when the congregation document does not exist', async () => {
    mockGetFirestore.mockReturnValue(buildDb(null));
    await expect(assertAdministrativeBillingAccess('cong-1')).resolves.toBeUndefined();
  });

  it('does not throw when there is no billing map', async () => {
    mockGetFirestore.mockReturnValue(buildDb({ name: 'Cong 1' }));
    await expect(assertAdministrativeBillingAccess('cong-1')).resolves.toBeUndefined();
  });

  it('does not throw for a healthy Stripe subscription', async () => {
    mockGetFirestore.mockReturnValue(
      buildDb({ billing: { provider: 'stripe', status: 'active', adminRestricted: false } })
    );
    await expect(assertAdministrativeBillingAccess('cong-1')).resolves.toBeUndefined();
  });

  it('throws failed-precondition when billing.adminRestricted is true', async () => {
    mockGetFirestore.mockReturnValue(
      buildDb({ billing: { provider: 'stripe', status: 'active', adminRestricted: true } })
    );
    await expect(assertAdministrativeBillingAccess('cong-1')).rejects.toMatchObject({
      code: 'failed-precondition',
    });
  });

  it.each(['unpaid', 'canceled', 'incomplete_expired'])(
    'throws failed-precondition for terminal status %s',
    async (status) => {
      mockGetFirestore.mockReturnValue(buildDb({ billing: { provider: 'stripe', status } }));
      await expect(assertAdministrativeBillingAccess('cong-1')).rejects.toBeInstanceOf(HttpsError);
    }
  );

  it('throws once the grace period for past_due has expired', async () => {
    mockGetFirestore.mockReturnValue(
      buildDb({
        billing: {
          provider: 'stripe',
          status: 'past_due',
          graceUntil: { toMillis: () => Date.now() - 1000 },
        },
      })
    );
    await expect(assertAdministrativeBillingAccess('cong-1')).rejects.toBeInstanceOf(HttpsError);
  });

  it('does not throw while the past_due grace period is still active', async () => {
    mockGetFirestore.mockReturnValue(
      buildDb({
        billing: {
          provider: 'stripe',
          status: 'past_due',
          graceUntil: { toMillis: () => Date.now() + 86_400_000 },
        },
      })
    );
    await expect(assertAdministrativeBillingAccess('cong-1')).resolves.toBeUndefined();
  });

  it('does not throw when billingExemption is active, even if adminRestricted is true', async () => {
    mockGetFirestore.mockReturnValue(
      buildDb({
        billing: { provider: 'stripe', status: 'unpaid', adminRestricted: true },
        billingExemption: { exempt: true },
      })
    );
    await expect(assertAdministrativeBillingAccess('cong-1')).resolves.toBeUndefined();
  });

  it('does not throw for a non-Stripe provider (e.g. exempt)', async () => {
    mockGetFirestore.mockReturnValue(
      buildDb({ billing: { provider: 'exempt', status: 'exempt' } })
    );
    await expect(assertAdministrativeBillingAccess('cong-1')).resolves.toBeUndefined();
  });
});
