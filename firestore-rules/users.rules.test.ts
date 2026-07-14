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
  updateDoc,
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
  serviceAssignments?: Record<string, unknown>[];
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
      setDoc(doc(db, 'users/orgSupervisor'), userDoc({
        uid: 'orgSupervisor',
        role: 'supervisor',
        congregationId: 'c1',
        permissions: { organigrama: { manage: true } },
      })),
      setDoc(doc(db, 'users/coordinator'), userDoc({
        uid: 'coordinator',
        role: 'admin',
        congregationId: 'c1',
        servicePosition: 'coordinador',
        serviceAssignments: [{ position: 'coordinador', label: 'Coordinador' }],
      })),
      setDoc(doc(db, 'users/secretary'), userDoc({
        uid: 'secretary',
        role: 'admin',
        congregationId: 'c1',
        servicePosition: 'secretario',
        serviceAssignments: [{ position: 'secretario', label: 'Secretario' }],
      })),
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
      setDoc(doc(db, 'users/root'), userDoc({uid: 'root', role: 'admin', congregationId: 'c1'})),
      setDoc(doc(db, 'superAdmins/root'), {isActive: true}),
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

const departmentDoc = (createdBy: string) => ({
  congregationId: 'c1',
  name: 'Limpieza',
  order: 10,
  isActive: true,
  allowMultipleManagers: false,
  allowMultipleAssistants: true,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  createdBy,
  updatedBy: createdBy,
});

describe('org chart department rules', () => {
  it('blocks supervisor legacy organigrama.manage from creating departments', async () => {
    await assertFails(
      setDoc(
        doc(authedDb('orgSupervisor'), 'congregations/c1/departments/limpieza'),
        departmentDoc('orgSupervisor')
      )
    );
  });

  it('blocks common admins without coordinator/secretary assignment from creating departments', async () => {
    await assertFails(
      setDoc(
        doc(authedDb('admin'), 'congregations/c1/departments/limpieza'),
        departmentDoc('admin')
      )
    );
  });

  it('allows coordinator and secretary to create departments', async () => {
    await assertSucceeds(
      setDoc(
        doc(authedDb('coordinator'), 'congregations/c1/departments/coordinador-test'),
        departmentDoc('coordinator')
      )
    );
    await assertSucceeds(
      setDoc(
        doc(authedDb('secretary'), 'congregations/c1/departments/secretario-test'),
        departmentDoc('secretary')
      )
    );
  });

  it('blocks direct organization service assignment writes even for coordinator', async () => {
    await assertFails(
      updateDoc(doc(authedDb('coordinator'), 'users/member'), {
        serviceAssignments: [
          { position: 'encargado', department: 'limpieza', label: 'Encargado de Limpieza' },
        ],
        servicePosition: 'encargado',
        serviceDepartment: 'limpieza',
        department: 'Encargado de Limpieza',
        updatedAt: Timestamp.now(),
      })
    );
  });

  it('blocks supervisor legacy organigrama.manage from syncing organization service assignments', async () => {
    await assertFails(
      updateDoc(doc(authedDb('orgSupervisor'), 'users/member'), {
        serviceAssignments: [
          { position: 'encargado', department: 'limpieza', label: 'Encargado de Limpieza' },
        ],
        servicePosition: 'encargado',
        serviceDepartment: 'limpieza',
        department: 'Encargado de Limpieza',
        updatedAt: Timestamp.now(),
      })
    );
  });
});

describe('sensitive user writes', () => {
  it('blocks self role, permissions, congregation and protection escalation', async () => {
    const ref = doc(authedDb('member'), 'users/member');
    await assertFails(updateDoc(ref, {role: 'admin', updatedAt: Timestamp.now()}));
    await assertFails(updateDoc(ref, {permissions: {usuarios: {manage: true}}, updatedAt: Timestamp.now()}));
    await assertFails(updateDoc(ref, {congregationId: 'c2', updatedAt: Timestamp.now()}));
    await assertFails(updateDoc(ref, {protectedFromDeletion: true, updatedAt: Timestamp.now()}));
  });

  it('accepts acomodadores_microfonos and rejects unknown permission keys', async () => {
    const valid = userDoc({
      uid: 'hospitality-manager', role: 'supervisor', congregationId: 'c1',
      permissions: {acomodadores_microfonos: {view: true, manage: true}},
    });
    await assertSucceeds(setDoc(doc(authedDb('root'), 'users/hospitality-manager'), valid));
    await assertSucceeds(updateDoc(doc(authedDb('root'), 'users/hospitality-manager'), {
      permissions: {acomodadores_microfonos: {view: true, edit: true}},
      updatedAt: Timestamp.now(),
    }));
    await assertFails(setDoc(doc(authedDb('root'), 'users/invalid-permission'), {
      ...userDoc({uid: 'invalid-permission', role: 'user', congregationId: 'c1'}),
      permissions: {desconocido: {view: true}},
    }));
  });

  it('does not protect a user because of creator strings', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/string-marker'), {
        ...userDoc({uid: 'string-marker', role: 'user', congregationId: 'c1'}),
        createdBy: 'system', createdByName: 'Sistema Sistema', createdByEmail: 'tu_correo@gmail.com',
      });
    });
    await assertSucceeds(getDoc(doc(authedDb('admin'), 'users/string-marker')));
  });
});
