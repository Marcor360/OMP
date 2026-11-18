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
  setDoc,
} from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

const projectId = 'demo-omp';
const rules = readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8');

jest.setTimeout(30_000);

type SeedUser = {
  uid: string;
  role: 'admin' | 'supervisor' | 'user';
  congregationId: string;
  isActive?: boolean;
  permissions?: Record<string, unknown>;
  servicePosition?: string;
  // undefined = campo omitido por completo del documento (el hueco bajo prueba).
  // '' = campo presente pero vacio (no es el mismo caso: la rule original solo
  // se activaba con el campo AUSENTE del mapa).
  serviceDepartment?: string;
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
    serviceAssignments: [],
    serviceAssignmentKeys: serviceAssignmentKeys ?? [],
    protectedFromDeletion: false,
    isSystemUser: false,
    isPrimaryAdmin: false,
    isRootAdmin: false,
    systemProtected: false,
  },
  ...(permissions ? { permissions } : {}),
  // serviceDepartment SOLO se agrega si se paso explicitamente (incluso '').
  // Omitirlo deja el campo fuera del documento por completo.
  ...(serviceDepartment !== undefined ? { serviceDepartment } : {}),
});

const authedDb = (uid: string) => testEnv.authenticatedContext(uid).firestore();

const scheduleDoc = (uid: string, scheduleId: string, congregationId = 'c1') =>
  doc(authedDb(uid), `congregations/${congregationId}/cleaningSchedules/${scheduleId}`);

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
      // a. encargado de limpieza -> debe poder administrar cleaningSchedules.
      setDoc(doc(db, 'users/encargadoLimpieza'), userDoc({
        uid: 'encargadoLimpieza',
        role: 'user',
        congregationId: 'c1',
        servicePosition: 'encargado',
        serviceDepartment: 'limpieza',
      })),
      // b. encargado de OTRO departamento -> no debe colar como encargado de limpieza.
      setDoc(doc(db, 'users/encargadoReuniones'), userDoc({
        uid: 'encargadoReuniones',
        role: 'user',
        congregationId: 'c1',
        servicePosition: 'encargado',
        serviceDepartment: 'reuniones',
      })),
      // c. encargado SIN serviceDepartment en el documento -- el hueco original:
      // !('serviceDepartment' in currentUserData()) dejaba pasar a CUALQUIER
      // encargado, sin importar de que departamento fuera.
      setDoc(doc(db, 'users/encargadoSinDepto'), userDoc({
        uid: 'encargadoSinDepto',
        role: 'user',
        congregationId: 'c1',
        servicePosition: 'encargado',
      })),
      // d. via serviceAssignmentKeys, no afectada por el cambio.
      setDoc(doc(db, 'users/viaAssignmentKey'), userDoc({
        uid: 'viaAssignmentKey',
        role: 'user',
        congregationId: 'c1',
        serviceAssignmentKeys: ['encargado:limpieza'],
      })),
      // e. via permissions.limpieza.manage otorgado a mano, no afectada por el cambio.
      setDoc(doc(db, 'users/viaPermissions'), userDoc({
        uid: 'viaPermissions',
        role: 'user',
        congregationId: 'c1',
        permissions: { limpieza: { manage: true } },
      })),
    ]);
  });
});

const scheduleData = (overrides: Record<string, unknown> = {}) => ({
  congregationId: 'c1',
  title: 'Lista de limpieza',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  monthIds: ['2026-10'],
  totalMeetings: 8,
  status: 'draft',
  createdBy: 'encargadoLimpieza',
  updatedBy: 'encargadoLimpieza',
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  ...overrides,
});

// a. encargado con serviceDepartment 'limpieza' -> allow create cleaningSchedules.
test('encargado de limpieza can create a cleaning schedule', async () => {
  await assertSucceeds(setDoc(
    scheduleDoc('encargadoLimpieza', 'schedule1'),
    scheduleData()
  ));
});

// b. encargado con serviceDepartment 'reuniones' -> deny.
test('encargado of another department cannot create a cleaning schedule', async () => {
  await assertFails(setDoc(
    scheduleDoc('encargadoReuniones', 'schedule2'),
    scheduleData({ createdBy: 'encargadoReuniones', updatedBy: 'encargadoReuniones' })
  ));
});

// c. encargado SIN campo serviceDepartment -> deny (este es el hueco cerrado).
test('encargado without serviceDepartment field cannot create a cleaning schedule', async () => {
  await assertFails(setDoc(
    scheduleDoc('encargadoSinDepto', 'schedule3'),
    scheduleData({ createdBy: 'encargadoSinDepto', updatedBy: 'encargadoSinDepto' })
  ));
});

// d. serviceAssignmentKeys ['encargado:limpieza'] -> allow, via no afectada.
test('user with serviceAssignmentKeys encargado:limpieza can create a cleaning schedule', async () => {
  await assertSucceeds(setDoc(
    scheduleDoc('viaAssignmentKey', 'schedule4'),
    scheduleData({ createdBy: 'viaAssignmentKey', updatedBy: 'viaAssignmentKey' })
  ));
});

// e. usuario con permissions.limpieza.manage -> allow, via no afectada.
test('user with permissions.limpieza.manage can create a cleaning schedule', async () => {
  await assertSucceeds(setDoc(
    scheduleDoc('viaPermissions', 'schedule5'),
    scheduleData({ createdBy: 'viaPermissions', updatedBy: 'viaPermissions' })
  ));
});


const seed = async (path: string, data: Record<string, unknown>, merge = false) => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data, { merge });
  });
};

test('preserves access with active billing and nonblocking system documents', async () => {
  const systemStatus = {
    maintenanceMode: false,
    systemMaintenance: false,
    disableCongregations: false,
    allCongregationsDisabled: false,
    congregationsDisabled: false,
    enabled: true,
    isActive: true,
  };
  await Promise.all([
    seed('system/maintenance', systemStatus),
    seed('system/platform', systemStatus),
    seed('system/congregationAccess', systemStatus),
    seed('congregations/c1', {
      billing: { provider: 'stripe', status: 'active', adminRestricted: false },
    }, true),
  ]);
  await assertSucceeds(setDoc(
    scheduleDoc('viaAssignmentKey', 'active-billing'),
    scheduleData({ createdBy: 'viaAssignmentKey', updatedBy: 'viaAssignmentKey' })
  ));
});

test('denies an inactive cleaning manager', async () => {
  await seed('users/encargadoLimpieza', { isActive: false }, true);
  await assertFails(setDoc(scheduleDoc('encargadoLimpieza', 'inactive'), scheduleData()));
});

test('denies a cleaning manager in a different congregation', async () => {
  await assertFails(setDoc(
    scheduleDoc('encargadoLimpieza', 'wrong-congregation', 'c2'),
    scheduleData({ congregationId: 'c2' })
  ));
});

test('denies creation when billing restricts administrative writes', async () => {
  await seed('congregations/c1', {
    billing: { provider: 'stripe', status: 'active', adminRestricted: true },
  }, true);
  await assertFails(setDoc(scheduleDoc('encargadoLimpieza', 'billing'), scheduleData()));
});

test('denies creation when maintenance blocks access', async () => {
  await seed('system/maintenance', { maintenanceMode: true });
  await assertFails(setDoc(scheduleDoc('encargadoLimpieza', 'maintenance'), scheduleData()));
});

test('allows an expired congregation block but rejects an active block', async () => {
  await seed('congregations/c1', {
    disabled: true,
    blockedUntil: Timestamp.fromMillis(Date.now() + 3600000),
  }, true);
  await assertFails(setDoc(scheduleDoc('encargadoLimpieza', 'blocked'), scheduleData()));
  await seed('congregations/c1', {
    blockedUntil: Timestamp.fromMillis(Date.now() - 3600000),
  }, true);
  await assertSucceeds(setDoc(scheduleDoc('encargadoLimpieza', 'expired'), scheduleData()));
});

test('validates document ownership and preserves creation metadata on update', async () => {
  const ref = scheduleDoc('encargadoLimpieza', 'ownership');
  const data = scheduleData();
  await assertFails(setDoc(ref, { ...data, createdBy: 'another-user' }));
  await assertSucceeds(setDoc(ref, data));
  await assertFails(setDoc(ref, { ...data, createdAt: Timestamp.fromMillis(0) }));
  await assertSucceeds(setDoc(ref, { ...data, title: 'Lista corregida' }));
});

test('validates cleaning schedule items with the same access and ownership checks', async () => {
  const scheduleId = 'schedule-with-items';
  const ref = doc(authedDb('encargadoLimpieza'),
    `congregations/c1/cleaningSchedules/${scheduleId}/items/item1`);
  const item = {
    congregationId: 'c1',
    scheduleId,
    meetingDate: '2026-10-01',
    meetingType: 'midweek',
    cleaningGroupId: 'group1',
    cleaningGroupName: 'Grupo uno',
    status: 'scheduled',
    createdBy: 'encargadoLimpieza',
    updatedBy: 'encargadoLimpieza',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  await assertSucceeds(setDoc(scheduleDoc('encargadoLimpieza', scheduleId), scheduleData()));
  await assertFails(setDoc(ref, { ...item, scheduleId: 'other-schedule' }));
  await assertSucceeds(setDoc(ref, item));
  await assertSucceeds(setDoc(ref, { ...item, status: 'completed' }));
  await seed('congregations/c1', {
    billing: { provider: 'stripe', status: 'active', adminRestricted: true },
  }, true);
  await assertFails(setDoc(ref, { ...item, status: 'cancelled' }));
});
