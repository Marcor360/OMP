import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { Timestamp, collection, doc, getDoc, setDoc } from 'firebase/firestore';

import {
  initRulesTestEnv,
  makeAuthedDb,
  seedCongregations,
  seedUsers,
} from './test-support/rules-test-helpers';

/**
 * Dominio "limpieza": /congregations/{congregationId}/cleaningGroups/{id}.
 * Incluye tambien la coleccion raiz legacy /cleaningGroups (sin anidar en
 * congregations), cerrada por completo (read y write siempre false) para
 * mantener el aislamiento por congregacion.
 */

let testEnv: RulesTestEnvironment;
let authedDb: ReturnType<typeof makeAuthedDb>;

jest.setTimeout(30_000);

const cleaningGroupPayload = (congregationId: string, createdBy: string) => ({
  name: 'Grupo de prueba',
  congregationId,
  groupType: 'standard',
  memberIds: [],
  memberCount: 0,
  isActive: true,
  createdBy,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
});

beforeAll(async () => {
  testEnv = await initRulesTestEnv('omp-cleaning-rules');
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
    { uid: 'manager', role: 'user', congregationId: 'c1', permissions: { limpieza: { manage: true } } },
    { uid: 'plainUser', role: 'user', congregationId: 'c1' },
  ]);
});

describe('cleaning domain: role, congregation isolation, active status', () => {
  it('allows an admin to create a cleaning group in their own congregation', async () => {
    await assertSucceeds(
      setDoc(
        doc(collection(authedDb('admin'), 'congregations/c1/cleaningGroups')),
        cleaningGroupPayload('c1', 'admin')
      )
    );
  });

  it('denies an admin creating a cleaning group tagged with another congregation', async () => {
    await assertFails(
      setDoc(
        doc(collection(authedDb('admin'), 'congregations/c1/cleaningGroups')),
        cleaningGroupPayload('c2', 'admin')
      )
    );
  });

  it('denies an inactive admin from creating a cleaning group', async () => {
    await assertFails(
      setDoc(
        doc(collection(authedDb('inactiveAdmin'), 'congregations/c1/cleaningGroups')),
        cleaningGroupPayload('c1', 'inactiveAdmin')
      )
    );
  });
});

describe('cleaning domain: granular permission (permissions.limpieza.manage)', () => {
  it('lets a user with permissions.limpieza.manage create a cleaning group', async () => {
    await assertSucceeds(
      setDoc(
        doc(collection(authedDb('manager'), 'congregations/c1/cleaningGroups')),
        cleaningGroupPayload('c1', 'manager')
      )
    );
  });

  it('denies a plain user without the limpieza permission', async () => {
    await assertFails(
      setDoc(
        doc(collection(authedDb('plainUser'), 'congregations/c1/cleaningGroups')),
        cleaningGroupPayload('c1', 'plainUser')
      )
    );
  });
});

describe('cleaning domain: legacy root collection is fully closed', () => {
  it('denies reading the root-level cleaningGroups collection even for an admin', async () => {
    let groupId = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = doc(collection(context.firestore(), 'cleaningGroups'));
      groupId = ref.id;
      await setDoc(ref, cleaningGroupPayload('c1', 'admin'));
    });

    await assertFails(getDoc(doc(authedDb('admin'), 'cleaningGroups', groupId)));
  });

  it('denies writing to the root-level cleaningGroups collection even for an admin', async () => {
    await assertFails(
      setDoc(doc(collection(authedDb('admin'), 'cleaningGroups')), cleaningGroupPayload('c1', 'admin'))
    );
  });
});
