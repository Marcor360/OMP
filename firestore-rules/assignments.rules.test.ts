import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { collection, doc, setDoc } from 'firebase/firestore';

import {
  initRulesTestEnv,
  makeAuthedDb,
  seedCongregations,
  seedUsers,
} from './test-support/rules-test-helpers';

/**
 * Dominio "asignaciones": /congregations/{congregationId}/assignments/{id}
 * (standalone, distinto de las asignaciones anidadas bajo meetings).
 * Incluye tambien outgoingTalks (discursos de salida), que vive en el
 * mismo modulo de asignaciones de la app y es la coleccion solo-Functions
 * mas representativa de este dominio (create/update siempre false).
 */

let testEnv: RulesTestEnvironment;
let authedDb: ReturnType<typeof makeAuthedDb>;

jest.setTimeout(30_000);

const assignmentPayload = (congregationId: string) => ({
  congregationId,
  category: 'limpieza',
  type: 'standalone',
  title: 'Asignacion de prueba',
});

beforeAll(async () => {
  testEnv = await initRulesTestEnv('omp-assignments-rules');
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
    { uid: 'manager', role: 'user', congregationId: 'c1', permissions: { asignaciones: { manage: true } } },
    { uid: 'plainUser', role: 'user', congregationId: 'c1' },
  ]);
});

describe('assignments domain: role, congregation isolation, active status', () => {
  it('allows an admin to create an assignment in their own congregation', async () => {
    await assertSucceeds(
      setDoc(doc(collection(authedDb('admin'), 'congregations/c1/assignments')), assignmentPayload('c1'))
    );
  });

  it('denies an admin creating an assignment tagged with another congregation', async () => {
    await assertFails(
      setDoc(doc(collection(authedDb('admin'), 'congregations/c1/assignments')), assignmentPayload('c2'))
    );
  });

  it('denies an inactive admin from creating an assignment', async () => {
    await assertFails(
      setDoc(doc(collection(authedDb('inactiveAdmin'), 'congregations/c1/assignments')), assignmentPayload('c1'))
    );
  });
});

describe('assignments domain: granular permission (permissions.asignaciones.manage)', () => {
  it('lets a user with permissions.asignaciones.manage create an assignment', async () => {
    await assertSucceeds(
      setDoc(doc(collection(authedDb('manager'), 'congregations/c1/assignments')), assignmentPayload('c1'))
    );
  });

  it('denies a plain user without the asignaciones permission', async () => {
    await assertFails(
      setDoc(doc(collection(authedDb('plainUser'), 'congregations/c1/assignments')), assignmentPayload('c1'))
    );
  });
});

describe('assignments domain: outgoing talks are Cloud-Functions-only', () => {
  it('denies direct client writes to outgoingTalks even for an admin', async () => {
    await assertFails(
      setDoc(doc(collection(authedDb('admin'), 'congregations/c1/outgoingTalks')), {
        congregationId: 'c1',
        userId: 'admin',
        status: 'scheduled',
      })
    );
  });
});
