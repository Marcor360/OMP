import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { Timestamp, collection, doc, setDoc } from 'firebase/firestore';

import {
  initRulesTestEnv,
  makeAuthedDb,
  seedCongregations,
  seedUsers,
} from './test-support/rules-test-helpers';

/**
 * Dominio "reuniones": /congregations/{congregationId}/meetings/{meetingId}
 * y su subcoleccion solo-Functions /meetings/{meetingId}/assignments/{id}.
 */

let testEnv: RulesTestEnvironment;
let authedDb: ReturnType<typeof makeAuthedDb>;

jest.setTimeout(30_000);

const meetingPayload = (overrides: Partial<Record<string, unknown>> = {}) => ({
  type: 'midweek',
  title: 'Reunion de prueba',
  startDate: Timestamp.now(),
  endDate: Timestamp.now(),
  meetingDate: Timestamp.now(),
  status: 'scheduled',
  ...overrides,
});

beforeAll(async () => {
  testEnv = await initRulesTestEnv('omp-meetings-rules');
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
    { uid: 'manager', role: 'user', congregationId: 'c1', permissions: { reuniones: { manage: true } } },
    { uid: 'plainUser', role: 'user', congregationId: 'c1' },
  ]);
});

describe('meetings domain: role, congregation isolation, active status', () => {
  it('allows an admin to create a meeting in their own congregation', async () => {
    await assertSucceeds(
      setDoc(doc(collection(authedDb('admin'), 'congregations/c1/meetings')), meetingPayload())
    );
  });

  it('denies an admin creating a meeting under a congregation that is not theirs', async () => {
    await assertFails(
      setDoc(doc(collection(authedDb('admin'), 'congregations/c2/meetings')), meetingPayload())
    );
  });

  it('denies an inactive admin from creating a meeting', async () => {
    await assertFails(
      setDoc(doc(collection(authedDb('inactiveAdmin'), 'congregations/c1/meetings')), meetingPayload())
    );
  });
});

describe('meetings domain: granular permission (permissions.reuniones.manage)', () => {
  it('lets a user with permissions.reuniones.manage create a meeting', async () => {
    await assertSucceeds(
      setDoc(doc(collection(authedDb('manager'), 'congregations/c1/meetings')), meetingPayload())
    );
  });

  it('denies a plain user without the reuniones permission', async () => {
    await assertFails(
      setDoc(doc(collection(authedDb('plainUser'), 'congregations/c1/meetings')), meetingPayload())
    );
  });
});

describe('meetings domain: nested assignments are Cloud-Functions-only', () => {
  it('denies direct client writes to meetings/{id}/assignments even for an admin', async () => {
    let meetingId = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = doc(collection(context.firestore(), 'congregations/c1/meetings'));
      meetingId = ref.id;
      await setDoc(ref, meetingPayload());
    });

    await assertFails(
      setDoc(
        doc(collection(authedDb('admin'), `congregations/c1/meetings/${meetingId}/assignments`)),
        { title: 'Asignacion', assignedToUid: 'admin' }
      )
    );
  });
});
