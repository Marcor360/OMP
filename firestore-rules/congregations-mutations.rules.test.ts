import { readFileSync } from 'fs';
import { resolve } from 'path';

import {
  RulesTestEnvironment,
  assertFails,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

const projectId = `omp-rules-congregations-mutations-${Date.now()}`;
const rules = readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8');

jest.setTimeout(30_000);

const userDoc = (uid: string, role: 'admin' | 'supervisor' | 'user', congregationId: string) => ({
  uid,
  email: `${uid}@example.com`,
  firstName: uid,
  lastName: 'User',
  role,
  isActive: true,
  congregationId,
  servicePosition: '',
  serviceDepartment: '',
  serviceAssignments: [],
  serviceAssignmentKeys: [],
  protectedFromDeletion: false,
  isSystemUser: false,
  isPrimaryAdmin: false,
  isRootAdmin: false,
  systemProtected: false,
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
      setDoc(doc(db, 'users/admin'), userDoc('admin', 'admin', 'c1')),
    ]);
  });
});

// SEC/QA: create y update del documento de congregación pasan a estar
// cerrados a cliente porque hasOnlyKeys() no puede validar el documento
// resultante completo una vez que Cloud Functions escribe billing/
// billingExemption ahí. Ver rules_src/21-congregations-people-meetings.rules.

test('admin cannot update congregation document from the client', async () => {
  await assertFails(
    updateDoc(doc(authedDb('admin'), 'congregations/c1'), { name: 'Renamed' })
  );
});

test('admin cannot create a new congregation document from the client', async () => {
  await assertFails(
    setDoc(doc(authedDb('admin'), 'congregations/c3'), {
      name: 'Congregation 3',
      isActive: true,
    })
  );
});
