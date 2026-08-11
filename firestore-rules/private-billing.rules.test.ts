import { readFileSync } from 'fs';
import { resolve } from 'path';

import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

const projectId = `omp-rules-private-billing-${Date.now()}`;
const rules = readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8');

jest.setTimeout(30_000);

type SeedUser = {
  uid: string;
  role: 'admin' | 'supervisor' | 'user';
  congregationId: string;
  isActive?: boolean;
  permissions?: Record<string, unknown>;
  serviceAssignments?: Record<string, unknown>[];
  serviceAssignmentKeys?: string[];
};

const userDoc = ({
  uid,
  role,
  congregationId,
  isActive = true,
  permissions,
  serviceAssignments,
  serviceAssignmentKeys,
}: SeedUser) => ({
  uid,
  email: `${uid}@example.com`,
  firstName: uid,
  lastName: 'User',
  role,
  isActive,
  congregationId,
  servicePosition: '',
  serviceDepartment: '',
  serviceAssignments: serviceAssignments ?? [],
  serviceAssignmentKeys: serviceAssignmentKeys ?? [],
  protectedFromDeletion: false,
  isSystemUser: false,
  isPrimaryAdmin: false,
  isRootAdmin: false,
  systemProtected: false,
  ...(permissions ? { permissions } : {}),
});

const authedDb = (uid: string) => testEnv.authenticatedContext(uid).firestore();

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules,
      host: '127.0.0.1',
      port: 9085,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'congregations/c1'), {
        name: 'Congregation 1',
        isActive: true,
        active: true,
        enabled: true,
        disabled: false,
        deactivated: false,
        accessDisabled: false,
        status: 'active',
      }),
      setDoc(doc(db, 'congregations/c2'), {
        name: 'Congregation 2',
        isActive: true,
        active: true,
        enabled: true,
        disabled: false,
        deactivated: false,
        accessDisabled: false,
        status: 'active',
      }),
      setDoc(doc(db, 'congregations/c1/private/billing'), {
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
      }),
      setDoc(doc(db, 'congregations/c1/private/plan'), {
        planKey: 'omp_150',
      }),
      setDoc(doc(db, 'users/admin'), userDoc({
        uid: 'admin', role: 'admin', congregationId: 'c1',
      })),
      setDoc(doc(db, 'users/treasurer'), userDoc({
        uid: 'treasurer',
        role: 'user',
        congregationId: 'c1',
        serviceAssignments: [{ position: 'encargado', department: 'tesoreria' }],
        serviceAssignmentKeys: ['encargado:tesoreria'],
      })),
      setDoc(doc(db, 'users/member'), userDoc({
        uid: 'member', role: 'user', congregationId: 'c1',
      })),
      setDoc(doc(db, 'users/outsiderAdmin'), userDoc({
        uid: 'outsiderAdmin', role: 'admin', congregationId: 'c2',
      })),
    ]);
  });
});

const privateBillingDoc = (uid: string) =>
  doc(authedDb(uid), 'congregations/c1/private/billing');

const privatePlanDoc = (uid: string) =>
  doc(authedDb(uid), 'congregations/c1/private/plan');

test('admin can read private/billing', async () => {
  await assertSucceeds(getDoc(privateBillingDoc('admin')));
});

test('treasury manager can read private/billing', async () => {
  await assertSucceeds(getDoc(privateBillingDoc('treasurer')));
});

test('regular member cannot read private/billing', async () => {
  await assertFails(getDoc(privateBillingDoc('member')));
});

test('admin from another congregation cannot read private/billing', async () => {
  await assertFails(getDoc(privateBillingDoc('outsiderAdmin')));
});

test('no role can write private/billing from the client', async () => {
  await assertFails(setDoc(privateBillingDoc('admin'), { stripeCustomerId: 'cus_evil' }));
});

test('treasury manager cannot read other private docs (e.g. plan)', async () => {
  await assertFails(getDoc(privatePlanDoc('treasurer')));
});

test('admin can still read private/plan', async () => {
  await assertSucceeds(getDoc(privatePlanDoc('admin')));
});
