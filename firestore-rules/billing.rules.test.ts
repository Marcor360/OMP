import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

import {
  initRulesTestEnv,
  makeAuthedDb,
  seedCongregations,
  seedUsers,
} from './test-support/rules-test-helpers';

/**
 * Dominio "billing-lectura": /congregations/{congregationId}/billingHistory/{id}.
 * Es el historial de eventos de Stripe: solo lectura para roles con
 * visibilidad de pagos, y create/update/delete SIEMPRE denegados (el
 * ledger lo escribe unicamente el webhook de Stripe via Cloud Functions
 * con el Admin SDK, que ignora estas reglas).
 */

let testEnv: RulesTestEnvironment;
let authedDb: ReturnType<typeof makeAuthedDb>;

jest.setTimeout(30_000);

const billingEventPayload = () => ({
  type: 'invoice.paid',
  status: 'paid',
  amount: 1999,
});

beforeAll(async () => {
  testEnv = await initRulesTestEnv('omp-billing-rules');
  authedDb = makeAuthedDb(testEnv);
});

afterAll(async () => {
  await testEnv?.cleanup();
});

let billingEventId = '';

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedCongregations(testEnv, { active: ['c1', 'c2'] });
  await seedUsers(testEnv, [
    { uid: 'admin', role: 'admin', congregationId: 'c1' },
    { uid: 'inactiveAdmin', role: 'admin', congregationId: 'c1', isActive: false },
    { uid: 'otherCongregationAdmin', role: 'admin', congregationId: 'c2' },
    { uid: 'payViewer', role: 'user', congregationId: 'c1', permissions: { pagos: { view: true } } },
    { uid: 'plainUser', role: 'user', congregationId: 'c1' },
  ]);
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const ref = doc(collection(context.firestore(), 'congregations/c1/billingHistory'));
    billingEventId = ref.id;
    await setDoc(ref, billingEventPayload());
  });
});

describe('billing history: read access', () => {
  it('allows an admin to read their congregation billing history', async () => {
    await assertSucceeds(getDoc(doc(authedDb('admin'), `congregations/c1/billingHistory/${billingEventId}`)));
  });

  it('allows a user with permissions.pagos.view to read billing history', async () => {
    await assertSucceeds(getDoc(doc(authedDb('payViewer'), `congregations/c1/billingHistory/${billingEventId}`)));
  });

  it('denies a plain user without the pagos permission from reading billing history', async () => {
    await assertFails(getDoc(doc(authedDb('plainUser'), `congregations/c1/billingHistory/${billingEventId}`)));
  });

  it('denies an admin from another congregation reading billing history that is not theirs', async () => {
    await assertFails(getDoc(doc(authedDb('otherCongregationAdmin'), `congregations/c1/billingHistory/${billingEventId}`)));
  });

  it('denies an inactive admin from reading billing history', async () => {
    await assertFails(getDoc(doc(authedDb('inactiveAdmin'), `congregations/c1/billingHistory/${billingEventId}`)));
  });
});

describe('billing history: writes are Cloud-Functions-only', () => {
  it('denies creating a billing history document even for an admin', async () => {
    await assertFails(
      setDoc(doc(collection(authedDb('admin'), 'congregations/c1/billingHistory')), billingEventPayload())
    );
  });

  it('denies updating a billing history document even for an admin', async () => {
    await assertFails(
      updateDoc(doc(authedDb('admin'), `congregations/c1/billingHistory/${billingEventId}`), { status: 'refunded' })
    );
  });

  it('denies deleting a billing history document even for an admin', async () => {
    await assertFails(deleteDoc(doc(authedDb('admin'), `congregations/c1/billingHistory/${billingEventId}`)));
  });
});
