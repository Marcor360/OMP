import { readFileSync } from 'fs';
import { resolve } from 'path';

import {
  RulesTestEnvironment,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { Timestamp, doc, setDoc } from 'firebase/firestore';

/**
 * Helpers compartidos para los tests de contrato de firestore.rules por
 * dominio. No es un archivo *.test.ts: jest.rules.config.js no lo
 * recogera como suite (testMatch solo agarra firestore-rules/**\/*.test.ts).
 */

export type SeedRole = 'admin' | 'supervisor' | 'user';

export type SeedUser = {
  uid: string;
  role: SeedRole;
  congregationId: string;
  isActive?: boolean;
  permissions?: Record<string, Record<string, unknown>>;
  servicePosition?: string;
  serviceDepartment?: string;
  serviceAssignments?: Record<string, unknown>[];
  serviceAssignmentKeys?: string[];
  protectedFromDeletion?: boolean;
  isSystemUser?: boolean;
  isPrimaryAdmin?: boolean;
  isRootAdmin?: boolean;
  systemProtected?: boolean;
};

export const userDoc = ({
  uid,
  role,
  congregationId,
  isActive = true,
  permissions,
  servicePosition,
  serviceDepartment,
  serviceAssignments,
  serviceAssignmentKeys,
  protectedFromDeletion = false,
  isSystemUser = false,
  isPrimaryAdmin = false,
  isRootAdmin = false,
  systemProtected = false,
}: SeedUser) => ({
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
  protectedFromDeletion,
  isSystemUser,
  isPrimaryAdmin,
  isRootAdmin,
  systemProtected,
  ...(permissions ? { permissions } : {}),
});

export const activeCongregationDoc = (name = 'Congregation') => ({
  name,
  isActive: true,
  active: true,
  enabled: true,
  disabled: false,
  deactivated: false,
  accessDisabled: false,
  status: 'active',
});

export const suspendedCongregationDoc = (name = 'Suspended') => ({
  name,
  isActive: false,
  status: 'suspended',
  updatedAt: Timestamp.now(),
});

export async function seedCongregations(
  testEnv: RulesTestEnvironment,
  ids: { active?: string[]; suspended?: string[] } = {}
): Promise<void> {
  const active = ids.active ?? ['c1', 'c2'];
  const suspended = ids.suspended ?? [];

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      ...active.map((id) => setDoc(doc(db, `congregations/${id}`), activeCongregationDoc(id))),
      ...suspended.map((id) => setDoc(doc(db, `congregations/${id}`), suspendedCongregationDoc(id))),
    ]);
  });
}

export async function seedUsers(testEnv: RulesTestEnvironment, users: SeedUser[]): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all(users.map((user) => setDoc(doc(db, `users/${user.uid}`), userDoc(user))));
  });
}

export function makeAuthedDb(testEnv: RulesTestEnvironment) {
  return (uid: string) => testEnv.authenticatedContext(uid).firestore();
}

export async function initRulesTestEnv(projectPrefix: string): Promise<RulesTestEnvironment> {
  const rules = readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8');
  return initializeTestEnvironment({
    projectId: `${projectPrefix}-${Date.now()}`,
    firestore: { rules, host: '127.0.0.1', port: 9085 },
  });
}
