import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, setDoc } from 'firebase/firestore';

import {
  initRulesTestEnv,
  makeAuthedDb,
  seedCongregations,
  seedUsers,
} from './test-support/rules-test-helpers';

/**
 * Complementa firestore-rules/notifications.rules.test.ts (lectura/marcado
 * como leido) con creacion por permiso granular, aislamiento entre
 * congregaciones, inactividad, y la coleccion raiz /notifications
 * (distinta de /congregations/{id}/notifications), reservada a superadmin.
 */

let testEnv: RulesTestEnvironment;
let authedDb: ReturnType<typeof makeAuthedDb>;

jest.setTimeout(30_000);

const notificationPayload = (congregationId: string) => ({
  congregationId,
  title: 'Titulo de prueba',
  body: 'Cuerpo de prueba',
  type: 'general',
  isRead: false,
});

beforeAll(async () => {
  testEnv = await initRulesTestEnv('omp-notifications-permissions-rules');
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
    { uid: 'notifier', role: 'user', congregationId: 'c1', permissions: { avisos: { create: true } } },
    { uid: 'plainUser', role: 'user', congregationId: 'c1' },
    { uid: 'root', role: 'admin', congregationId: 'c1' },
  ]);
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'superAdmins/root'), { isActive: true });
  });
});

describe('congregation notifications: role, congregation isolation, active status', () => {
  it('allows an admin to create a notification in their own congregation', async () => {
    await assertSucceeds(
      setDoc(doc(collection(authedDb('admin'), 'congregations/c1/notifications')), notificationPayload('c1'))
    );
  });

  it('denies an admin creating a notification tagged with another congregation', async () => {
    await assertFails(
      setDoc(doc(collection(authedDb('admin'), 'congregations/c1/notifications')), notificationPayload('c2'))
    );
  });

  it('denies an inactive admin from creating a notification', async () => {
    await assertFails(
      setDoc(doc(collection(authedDb('inactiveAdmin'), 'congregations/c1/notifications')), notificationPayload('c1'))
    );
  });
});

describe('congregation notifications: granular permission (permissions.avisos.create)', () => {
  it('lets a user with permissions.avisos.create create a notification', async () => {
    await assertSucceeds(
      setDoc(doc(collection(authedDb('notifier'), 'congregations/c1/notifications')), notificationPayload('c1'))
    );
  });

  it('denies a plain user without the avisos permission', async () => {
    await assertFails(
      setDoc(doc(collection(authedDb('plainUser'), 'congregations/c1/notifications')), notificationPayload('c1'))
    );
  });
});

describe('root notifications collection is reserved for super admins', () => {
  it('denies a regular admin from reading the root notifications collection', async () => {
    let notificationId = '';
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ref = doc(collection(context.firestore(), 'notifications'));
      notificationId = ref.id;
      await setDoc(ref, notificationPayload('c1'));
    });

    await assertFails(getDoc(doc(authedDb('admin'), 'notifications', notificationId)));
  });

  it('denies a regular admin from writing to the root notifications collection', async () => {
    await assertFails(
      setDoc(doc(collection(authedDb('admin'), 'notifications')), notificationPayload('c1'))
    );
  });

  it('allows a super admin to read and write the root notifications collection', async () => {
    const ref = doc(collection(authedDb('root'), 'notifications'));
    await assertSucceeds(setDoc(ref, notificationPayload('c1')));
    await assertSucceeds(getDoc(ref));
  });
});
