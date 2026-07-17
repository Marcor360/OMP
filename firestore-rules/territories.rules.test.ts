import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { Timestamp, collection, deleteDoc, doc, setDoc } from 'firebase/firestore';

import {
  initRulesTestEnv,
  makeAuthedDb,
  seedCongregations,
  seedUsers,
} from './test-support/rules-test-helpers';

/**
 * Dominio "territorios": /congregations/{congregationId}/territories/{id}.
 * No hay borrado directo: solo se puede pasar a status 'inactive' via
 * update (allow delete: if false), asi que ese es el caso "solo-Functions"
 * de este dominio (aunque en la practica ni siquiera Cloud Functions
 * necesita borrar, es una restriccion permanente de las reglas).
 */

let testEnv: RulesTestEnvironment;
let authedDb: ReturnType<typeof makeAuthedDb>;

jest.setTimeout(30_000);

const territoryPayload = (congregationId: string, createdBy: string) => ({
  congregationId,
  number: 1,
  description: 'Territorio de prueba',
  status: 'active',
  createdBy,
  updatedBy: createdBy,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
});

beforeAll(async () => {
  testEnv = await initRulesTestEnv('omp-territories-rules');
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
    { uid: 'inactiveAdmin', role: 'admin', congregationId: 'c1', isActive: false },
    {
      uid: 'manager',
      role: 'user',
      congregationId: 'c1',
      permissions: { predicacion: { territories: { create: true } } },
    },
    { uid: 'plainUser', role: 'user', congregationId: 'c1' },
  ]);
});

describe('territories domain: role, congregation isolation, active status', () => {
  it('allows an admin to create a territory in their own congregation', async () => {
    await assertSucceeds(
      setDoc(doc(collection(authedDb('admin'), 'congregations/c1/territories')), territoryPayload('c1', 'admin'))
    );
  });

  it('denies an admin creating a territory tagged with another congregation', async () => {
    await assertFails(
      setDoc(doc(collection(authedDb('admin'), 'congregations/c1/territories')), territoryPayload('c2', 'admin'))
    );
  });

  it('denies an inactive admin from creating a territory', async () => {
    await assertFails(
      setDoc(doc(collection(authedDb('inactiveAdmin'), 'congregations/c1/territories')), territoryPayload('c1', 'inactiveAdmin'))
    );
  });
});

describe('territories domain: granular permission (permissions.predicacion.territories.create)', () => {
  it('lets a user with the granular territories.create permission create a territory', async () => {
    await assertSucceeds(
      setDoc(doc(collection(authedDb('manager'), 'congregations/c1/territories')), territoryPayload('c1', 'manager'))
    );
  });

  it('denies a plain user without the territories permission', async () => {
    await assertFails(
      setDoc(doc(collection(authedDb('plainUser'), 'congregations/c1/territories')), territoryPayload('c1', 'plainUser'))
    );
  });
});

describe('territories domain: hard delete is always denied', () => {
  it('denies deleting a territory document even for an admin', async () => {
    let territoryId = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = doc(collection(context.firestore(), 'congregations/c1/territories'));
      territoryId = ref.id;
      await setDoc(ref, territoryPayload('c1', 'admin'));
    });

    await assertFails(deleteDoc(doc(authedDb('admin'), `congregations/c1/territories/${territoryId}`)));
  });
});
