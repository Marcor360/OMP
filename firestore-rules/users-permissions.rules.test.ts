import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { Timestamp, deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

import {
  initRulesTestEnv,
  makeAuthedDb,
  seedCongregations,
  seedUsers,
  userDoc,
} from './test-support/rules-test-helpers';

/**
 * Complementa firestore-rules/users.rules.test.ts con los casos exigidos
 * por la matriz de contrato del dominio "usuarios":
 * - permiso granular (permissions.usuarios.view) vs sin permiso
 * - inactivo pierde el permiso granular
 * - creacion/eliminacion de usuarios es exclusiva de Cloud Functions
 *   (solo isSuperAdmin puede escribir directo; el resto SIEMPRE se
 *   deniega, sea cual sea su rol).
 */

let testEnv: RulesTestEnvironment;
let authedDb: ReturnType<typeof makeAuthedDb>;

jest.setTimeout(30_000);

beforeAll(async () => {
  testEnv = await initRulesTestEnv('omp-users-permissions-rules');
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
    { uid: 'viewer', role: 'user', congregationId: 'c1', permissions: { usuarios: { view: true } } },
    { uid: 'inactiveViewer', role: 'user', congregationId: 'c1', isActive: false, permissions: { usuarios: { view: true } } },
    { uid: 'otherCongregationViewer', role: 'user', congregationId: 'c2', permissions: { usuarios: { view: true } } },
    { uid: 'member', role: 'user', congregationId: 'c1' },
    { uid: 'root', role: 'admin', congregationId: 'c1' },
  ]);
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'superAdmins/root'), { isActive: true });
  });
});

describe('users domain: granular permission (permissions.usuarios.view)', () => {
  it('lets a user with permissions.usuarios.view read same-congregation profiles', async () => {
    await assertSucceeds(getDoc(doc(authedDb('viewer'), 'users/member')));
  });

  it('does not let permissions.usuarios.view cross congregations', async () => {
    await assertFails(getDoc(doc(authedDb('otherCongregationViewer'), 'users/member')));
  });

  it('does not honor permissions.usuarios.view for an inactive user', async () => {
    await assertFails(getDoc(doc(authedDb('inactiveViewer'), 'users/member')));
  });

  it('does not let permissions.usuarios.view escalate to editing users', async () => {
    await assertFails(updateDoc(doc(authedDb('viewer'), 'users/member'), {
      displayName: 'Renamed',
      updatedAt: Timestamp.now(),
    }));
  });
});

describe('users domain: create/delete are Cloud-Functions-only', () => {
  const newUserPayload = userDoc({ uid: 'created-by-client', role: 'user', congregationId: 'c1' });

  it('denies a regular admin creating a user document directly', async () => {
    await assertFails(setDoc(doc(authedDb('admin'), 'users/created-by-client'), newUserPayload));
  });

  it('denies a regular admin deleting a user document directly', async () => {
    await assertFails(deleteDoc(doc(authedDb('admin'), 'users/member')));
  });

  it('allows a super admin to create and delete user documents directly', async () => {
    await assertSucceeds(setDoc(doc(authedDb('root'), 'users/created-by-client'), newUserPayload));
    await assertSucceeds(deleteDoc(doc(authedDb('root'), 'users/created-by-client')));
  });
});
