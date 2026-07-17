import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import {
  initRulesTestEnv,
  makeAuthedDb,
  seedCongregations,
  seedUsers,
} from './test-support/rules-test-helpers';

/**
 * Complementa firestore-rules/events.rules.test.ts (matriz de la spec
 * compartida, ver src/shared/capabilities.ts) con aislamiento entre
 * congregaciones e inactividad para el dominio "avisos" / eventos.
 *
 * Nota sobre "escritura de cliente en coleccion solo-Functions": no
 * aplica a /events/{eventId}. A diferencia de outgoingTalks, billingHistory
 * o dashboardSummary, las reglas permiten explicitamente la escritura
 * directa del cliente cuando canManageEvents() se cumple (ver
 * firestore.rules:1026-1038, funcion validEventCreate/validEventUpdate).
 * La app real solo escribe via Cloud Functions (createEventByManager,
 * etc.), pero eso es una decision de la app, no una restriccion de Rules.
 */

let testEnv: RulesTestEnvironment;
let authedDb: ReturnType<typeof makeAuthedDb>;

jest.setTimeout(30_000);

const eventPayload = (congregationId: string, createdBy: string) => ({
  congregationId,
  type: 'conmemoracion',
  title: 'Evento de prueba',
  startDate: serverTimestamp(),
  endDate: serverTimestamp(),
  deleteAt: serverTimestamp(),
  color: '#8B1E3F',
  createdBy,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

beforeAll(async () => {
  testEnv = await initRulesTestEnv('omp-events-domain-rules');
  authedDb = makeAuthedDb(testEnv);
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedCongregations(testEnv, { active: ['c1', 'c2'] });
  await seedUsers(testEnv, [
    { uid: 'admin', role: 'admin', congregationId: 'c1' },
    { uid: 'otherCongregationAdmin', role: 'admin', congregationId: 'c2' },
    { uid: 'inactiveAdmin', role: 'admin', congregationId: 'c1', isActive: false },
  ]);
});

describe('events domain: congregation isolation and active status', () => {
  it('allows an active admin to create an event in their own congregation', async () => {
    await assertSucceeds(
      setDoc(doc(collection(authedDb('admin'), 'events')), eventPayload('c1', 'admin'))
    );
  });

  it('denies an admin from creating an event tagged with another congregation', async () => {
    await assertFails(
      setDoc(doc(collection(authedDb('admin'), 'events')), eventPayload('c2', 'admin'))
    );
  });

  it('denies an admin from another congregation reading events that are not theirs', async () => {
    let eventId = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = doc(collection(context.firestore(), 'events'));
      eventId = ref.id;
      await setDoc(ref, eventPayload('c1', 'admin'));
    });

    await assertFails(getDoc(doc(authedDb('otherCongregationAdmin'), 'events', eventId)));
  });

  it('denies an inactive admin from creating events', async () => {
    await assertFails(
      setDoc(doc(collection(authedDb('inactiveAdmin'), 'events')), eventPayload('c1', 'inactiveAdmin'))
    );
  });
});
