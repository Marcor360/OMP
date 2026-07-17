import { readFileSync } from 'fs';
import { resolve } from 'path';

import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';

/**
 * Test de contrato: verifica que canManageEvents() en firestore.rules
 * produce el mismo veredicto que la spec compartida (src/shared/capabilities.ts,
 * functions/src/shared/capabilities.ts) para la misma matriz de casos.
 * Ver fixtures/avisos.capability-cases.json.
 */

type CapabilityProfile = {
  role?: 'admin' | 'supervisor' | 'user';
  permissions?: Record<string, Record<string, boolean>>;
  servicePosition?: string;
  serviceDepartment?: string;
  serviceAssignments?: { position?: string; department?: string }[];
  protectedFromDeletion?: boolean;
  isSystemUser?: boolean;
  isPrimaryAdmin?: boolean;
  isRootAdmin?: boolean;
  systemProtected?: boolean;
};

type FixtureCase = {
  description: string;
  profile: CapabilityProfile;
  expected: boolean;
};

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, 'fixtures/avisos.capability-cases.json'), 'utf8')
) as { cases: FixtureCase[] };

let testEnv: RulesTestEnvironment;
const projectId = `omp-events-rules-${Date.now()}`;
const rules = readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8');
const CONGREGATION_ID = 'c1';

jest.setTimeout(30_000);

const buildServiceAssignmentKeys = (
  assignments: CapabilityProfile['serviceAssignments']
): string[] =>
  (assignments ?? []).map(
    (assignment) => `${assignment.position ?? ''}:${assignment.department ?? ''}`
  );

const userDocFromProfile = (uid: string, profile: CapabilityProfile) => ({
  uid,
  email: `${uid}@example.com`,
  firstName: uid,
  lastName: 'User',
  role: profile.role ?? 'user',
  isActive: true,
  congregationId: CONGREGATION_ID,
  servicePosition: profile.servicePosition ?? '',
  serviceDepartment: profile.serviceDepartment ?? '',
  serviceAssignments: profile.serviceAssignments ?? [],
  serviceAssignmentKeys: buildServiceAssignmentKeys(profile.serviceAssignments),
  protectedFromDeletion: profile.protectedFromDeletion === true,
  isSystemUser: profile.isSystemUser === true,
  isPrimaryAdmin: profile.isPrimaryAdmin === true,
  isRootAdmin: profile.isRootAdmin === true,
  systemProtected: profile.systemProtected === true,
  ...(profile.permissions ? { permissions: profile.permissions } : {}),
});

const authedDb = (uid: string) => testEnv.authenticatedContext(uid).firestore();

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules, host: '127.0.0.1', port: 9085 },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('events rules contract: canManageEvents() matches the avisos capability spec', () => {
  it.each(fixture.cases)('$description', async ({ profile, expected }, index) => {
    const uid = `requester-${index}`;

    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, `congregations/${CONGREGATION_ID}`), {
        name: 'Congregation 1',
        isActive: true,
        status: 'active',
      });
      await setDoc(doc(db, `users/${uid}`), userDocFromProfile(uid, profile));
    });

    const eventRef = doc(collection(authedDb(uid), 'events'));
    const createEvent = setDoc(eventRef, {
      congregationId: CONGREGATION_ID,
      type: 'conmemoracion',
      title: 'Evento de prueba',
      startDate: serverTimestamp(),
      endDate: serverTimestamp(),
      deleteAt: serverTimestamp(),
      color: '#8B1E3F',
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (expected) {
      await assertSucceeds(createEvent);
    } else {
      await assertFails(createEvent);
    }
  });
});
