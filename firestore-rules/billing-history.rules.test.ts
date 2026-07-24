import { readFileSync } from 'fs';
import { resolve } from 'path';

import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

const projectId = `omp-rules-billing-history-${Date.now()}`;
const rules = readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8');

jest.setTimeout(30_000);

type SeedUser = {
  uid: string;
  role: 'admin' | 'supervisor' | 'user';
  congregationId: string;
  isActive?: boolean;
  permissions?: Record<string, unknown>;
  servicePosition?: string;
  serviceDepartment?: string;
  serviceAssignments?: Record<string, unknown>[];
  serviceAssignmentKeys?: string[];
};

const userDoc = ({
  uid,
  role,
  congregationId,
  isActive = true,
  permissions,
  servicePosition,
  serviceDepartment,
  serviceAssignments,
  serviceAssignmentKeys,
}: SeedUser) => ({
  ...{
    uid,
    email: `${uid}@example.com`,
    firstName: uid,
    lastName: 'User',
    role,
    isActive,
    congregationId,
    servicePosition: servicePosition ?? '',
    serviceDepartment: serviceDepartment ?? '',
    serviceAssignments: serviceAssignments ?? [],
    serviceAssignmentKeys: serviceAssignmentKeys ?? [],
    protectedFromDeletion: false,
    isSystemUser: false,
    isPrimaryAdmin: false,
    isRootAdmin: false,
    systemProtected: false,
  },
  ...(permissions ? { permissions } : {}),
  ...(servicePosition ? { servicePosition } : {}),
  ...(serviceDepartment ? { serviceDepartment } : {}),
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
      setDoc(doc(db, 'congregations/c1/billingHistory/evt_1'), {
        congregationId: 'c1',
        type: 'invoice.paid',
        amount: 7000,
        createdAt: Timestamp.now(),
      }),
      setDoc(doc(db, 'users/admin'), userDoc({
        uid: 'admin', role: 'admin', congregationId: 'c1',
      })),
      setDoc(doc(db, 'users/cleaningSup'), userDoc({
        uid: 'cleaningSup', role: 'supervisor', congregationId: 'c1',
      })),
      setDoc(doc(db, 'users/treasurer'), userDoc({
        uid: 'treasurer',
        role: 'user',
        congregationId: 'c1',
        serviceAssignments: [{ position: 'encargado', department: 'tesoreria' }],
        serviceAssignmentKeys: ['encargado:tesoreria'],
      })),
      setDoc(doc(db, 'users/assistant'), userDoc({
        uid: 'assistant',
        role: 'user',
        congregationId: 'c1',
        serviceAssignments: [{ position: 'auxiliar', department: 'tesoreria' }],
        serviceAssignmentKeys: ['auxiliar:tesoreria'],
      })),
      setDoc(doc(db, 'users/coordinator'), userDoc({
        uid: 'coordinator',
        role: 'user',
        congregationId: 'c1',
        serviceAssignments: [{ position: 'coordinador' }],
        serviceAssignmentKeys: ['coordinador:'],
      })),
      setDoc(doc(db, 'users/pagosViewer'), userDoc({
        uid: 'pagosViewer',
        role: 'user',
        congregationId: 'c1',
        permissions: { pagos: { view: true } },
      })),
      setDoc(doc(db, 'users/member'), userDoc({
        uid: 'member', role: 'user', congregationId: 'c1',
      })),
      setDoc(doc(db, 'users/outsider'), userDoc({
        uid: 'outsider', role: 'admin', congregationId: 'c2',
      })),
    ]);
  });
});

const billingHistoryDoc = (uid: string) =>
  doc(authedDb(uid), 'congregations/c1/billingHistory/evt_1');

test('admin can read billing history', async () => {
  await assertSucceeds(getDoc(billingHistoryDoc('admin')));
});

test('treasury manager can read billing history', async () => {
  await assertSucceeds(getDoc(billingHistoryDoc('treasurer')));
});

test('treasury assistant can read billing history', async () => {
  await assertSucceeds(getDoc(billingHistoryDoc('assistant')));
});

test('coordinator can read billing history', async () => {
  await assertSucceeds(getDoc(billingHistoryDoc('coordinator')));
});

test('user with pagos view permission can read billing history', async () => {
  await assertSucceeds(getDoc(billingHistoryDoc('pagosViewer')));
});

// FALLA HOY A PROPOSITO. firestore.rules:2731 permite isAdminOrSupervisor(),
// pero functions/src/shared/billing-access.ts:74 (canViewBilling) NO incluye
// supervisor. Lo corrige el PR 2.
test('supervisor without pagos permission cannot read billing history', async () => {
  await assertFails(getDoc(billingHistoryDoc('cleaningSup')));
});

test('regular member cannot read billing history', async () => {
  await assertFails(getDoc(billingHistoryDoc('member')));
});

test('admin from another congregation cannot read billing history', async () => {
  await assertFails(getDoc(billingHistoryDoc('outsider')));
});

test('admin cannot write billing history from the client', async () => {
  await assertFails(setDoc(
    doc(authedDb('admin'), 'congregations/c1/billingHistory/evt_2'),
    {
      congregationId: 'c1',
      type: 'invoice.paid',
      amount: 7000,
      createdAt: Timestamp.now(),
    }
  ));
});
