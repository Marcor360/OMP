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

const projectId = `omp-rules-${Date.now()}`;
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
};

const userDoc = ({
  uid,
  role,
  congregationId,
  isActive = true,
  permissions,
  servicePosition,
  serviceDepartment,
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
    serviceAssignments: [],
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
      setDoc(doc(db, 'congregations/suspended'), {
        name: 'Suspended',
        isActive: false,
        status: 'suspended',
        updatedAt: Timestamp.now(),
      }),
      setDoc(doc(db, 'users/admin'), userDoc({ uid: 'admin', role: 'admin', congregationId: 'c1' })),
      setDoc(doc(db, 'users/supervisor'), userDoc({ uid: 'supervisor', role: 'supervisor', congregationId: 'c1' })),
      setDoc(doc(db, 'users/member'), userDoc({ uid: 'member', role: 'user', congregationId: 'c1' })),
      setDoc(doc(db, 'users/manager'), userDoc({
        uid: 'manager',
        role: 'user',
        congregationId: 'c1',
        permissions: { usuarios: { view: true } },
      })),
      setDoc(doc(db, 'users/inactive'), userDoc({
        uid: 'inactive',
        role: 'user',
        congregationId: 'c1',
        isActive: false,
      })),
      setDoc(doc(db, 'users/other'), userDoc({ uid: 'other', role: 'user', congregationId: 'c2' })),
      setDoc(doc(db, 'users/suspendedAdmin'), userDoc({
        uid: 'suspendedAdmin',
        role: 'admin',
        congregationId: 'suspended',
      })),
      setDoc(doc(db, 'users/suspendedMember'), userDoc({
        uid: 'suspendedMember',
        role: 'user',
        congregationId: 'suspended',
      })),
    ]);
  });
});

describe('users rules', () => {
  it('allows an active user to read their own profile', async () => {
    await assertSucceeds(getDoc(doc(authedDb('member'), 'users/member')));
  });

  it('blocks a normal user from reading another profile in the same congregation', async () => {
    await assertFails(getDoc(doc(authedDb('member'), 'users/supervisor')));
  });

  it('allows admin and supervisor to read same-congregation users', async () => {
    await assertSucceeds(getDoc(doc(authedDb('admin'), 'users/member')));
    await assertSucceeds(getDoc(doc(authedDb('supervisor'), 'users/member')));
  });

  it('blocks same-role reads across congregations', async () => {
    await assertFails(getDoc(doc(authedDb('admin'), 'users/other')));
  });

  it('blocks inactive users from reading another profile', async () => {
    await assertFails(getDoc(doc(authedDb('inactive'), 'users/member')));
  });

  it('blocks congregation data access when the congregation is suspended', async () => {
    await assertFails(getDoc(doc(authedDb('suspendedAdmin'), 'users/suspendedMember')));
  });
});

describe('push token rules', () => {
  it('allows only the authenticated user to write their push token document', async () => {
    const ownTokenRef = doc(authedDb('member'), 'users/member/pushTokens/token-1');
    const otherTokenRef = doc(authedDb('admin'), 'users/member/pushTokens/token-2');

    await assertSucceeds(setDoc(ownTokenRef, {
      token: 'ExponentPushToken[test]',
      userId: 'member',
      congregationId: 'c1',
      platform: 'android',
      deviceName: 'Pixel',
      isActive: true,
      updatedAt: Timestamp.now(),
    }));

    await assertFails(setDoc(otherTokenRef, {
      token: 'ExponentPushToken[test]',
      userId: 'member',
      congregationId: 'c1',
      platform: 'android',
      deviceName: 'Pixel',
      isActive: true,
      updatedAt: Timestamp.now(),
    }));
  });
});
