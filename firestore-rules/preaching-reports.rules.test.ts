import { readFileSync } from 'fs';
import { resolve } from 'path';

import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

const projectId = `omp-rules-preaching-reports-${Date.now()}`;
const rules = readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8');

jest.setTimeout(30_000);

type SeedUser = {
  uid: string;
  role: 'admin' | 'supervisor' | 'user';
  congregationId: string;
  isActive?: boolean;
  privileges?: Record<string, unknown>;
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
  privileges,
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
  ...(privileges ? { privileges } : {}),
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
      setDoc(doc(db, 'congregations/c1/preachingReports/2026-07/submissions/member'), {
        congregationId: 'c1',
        userId: 'member',
        hours: 10,
      }),
      setDoc(doc(db, 'users/elderPreachingDept'), userDoc({
        uid: 'elderPreachingDept',
        role: 'user',
        congregationId: 'c1',
        servicePosition: 'encargado',
        serviceDepartment: 'predicacion',
        privileges: { isElder: true },
      })),
      setDoc(doc(db, 'users/elderTerritoriesKey'), userDoc({
        uid: 'elderTerritoriesKey',
        role: 'user',
        congregationId: 'c1',
        privileges: { isElder: true },
        serviceAssignments: [{ position: 'encargado', department: 'territorios' }],
        serviceAssignmentKeys: ['encargado:territorios'],
      })),
      setDoc(doc(db, 'users/assistantPreachKey'), userDoc({
        uid: 'assistantPreachKey',
        role: 'user',
        congregationId: 'c1',
        serviceAssignments: [{ position: 'auxiliar', department: 'predicacion' }],
        serviceAssignmentKeys: ['auxiliar:predicacion'],
      })),
      setDoc(doc(db, 'users/assistantTerrKey'), userDoc({
        uid: 'assistantTerrKey',
        role: 'user',
        congregationId: 'c1',
        serviceAssignments: [{ position: 'auxiliar', department: 'territorios' }],
        serviceAssignmentKeys: ['auxiliar:territorios'],
      })),
      setDoc(doc(db, 'users/member'), userDoc({
        uid: 'member', role: 'user', congregationId: 'c1',
      })),
      setDoc(doc(db, 'users/stranger'), userDoc({
        uid: 'stranger', role: 'user', congregationId: 'c1',
      })),
      setDoc(doc(db, 'users/outsider'), userDoc({
        uid: 'outsider', role: 'admin', congregationId: 'c2',
      })),
    ]);
  });
});

const submissions = (uid: string) =>
  collection(authedDb(uid), 'congregations/c1/preachingReports/2026-07/submissions');

test('elder preaching manager can list submissions through flat fields', async () => {
  await assertSucceeds(getDocs(submissions('elderPreachingDept')));
});

test('preaching assistant can list submissions through assignment key', async () => {
  await assertSucceeds(getDocs(submissions('assistantPreachKey')));
});

// FALLA HOY A PROPOSITO. firestore.rules:194-197 solo cubre
// hasServiceAssignmentKey(pos,'predicacion') y omite 'territorios',
// mientras src/types/user/index.ts:252 si cubre ambos. Lo corrige el PR 3.
test('elder territories manager can list submissions through assignment key', async () => {
  await assertSucceeds(getDocs(submissions('elderTerritoriesKey')));
});

// FALLA HOY A PROPOSITO. firestore.rules:194-197 solo cubre
// hasServiceAssignmentKey(pos,'predicacion') y omite 'territorios',
// mientras src/types/user/index.ts:252 si cubre ambos. Lo corrige el PR 3.
test('territories assistant can list submissions through assignment key', async () => {
  await assertSucceeds(getDocs(submissions('assistantTerrKey')));
});

test('regular member cannot list submissions', async () => {
  await assertFails(getDocs(submissions('member')));
});

test('another regular member cannot list submissions', async () => {
  await assertFails(getDocs(submissions('stranger')));
});

test('admin from another congregation cannot list submissions', async () => {
  await assertFails(getDocs(submissions('outsider')));
});

test('member can read their own submission', async () => {
  await assertSucceeds(getDoc(doc(
    authedDb('member'),
    'congregations/c1/preachingReports/2026-07/submissions/member'
  )));
});

test('member cannot read another member submission', async () => {
  await assertFails(getDoc(doc(
    authedDb('stranger'),
    'congregations/c1/preachingReports/2026-07/submissions/member'
  )));
});
