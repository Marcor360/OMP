import { test, expect, type Page } from '@playwright/test';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { readFile } from 'node:fs/promises';

const projectId = 'demo-omp';
const authOrigin = 'http://127.0.0.1:9099';
let environment: RulesTestEnvironment;
let credentials: { email: string; password: string };

const seedAdmin = async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  credentials = { email: `e2e-${suffix}@example.invalid`, password: 'E2e-pass-2026!' };
  const response = await fetch(`${authOrigin}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...credentials, returnSecureToken: true }),
  });
  if (!response.ok) throw new Error(`Auth emulator seed failed (${response.status}): ${await response.text()}`);
  const { localId } = await response.json() as { localId: string };
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await setDoc(doc(database, 'users', localId), {
      uid: localId,
      congregationId: 'e2e-congregation',
      role: 'admin',
      isActive: true,
      status: 'active',
      displayName: 'E2E Admin',
      email: credentials.email,
      serviceAssignments: [],
      permissions: {},
      privileges: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(database, 'congregations', 'e2e-congregation'), {
      name: 'E2E Congregation',
      activeUsersLimit: 80,
      plan: { key: 'omp_80', activeUsersLimit: 80 },
      billing: { enabled: false },
    });
  });
};

test.beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { host: '127.0.0.1', port: 9085, rules: await readFile('firestore.rules', 'utf8') },
  });
});

test.beforeEach(seedAdmin);
test.afterAll(async () => environment?.cleanup());

const login = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem('@omp/language', 'es');
    localStorage.setItem('@omp/language-onboarding-complete', '1');
  });
  await page.goto('/login');
  await page.getByPlaceholder('tu@email.com').fill(credentials.email);
  await page.getByPlaceholder('********').fill(credentials.password);
  await page.getByRole('button', { name: /iniciar sesión|iniciar sesion|log in/i }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 20_000 });
};

test('login uses the Auth emulator and opens the protected app', async ({ page }) => {
  await login(page);
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
});

test('session expires after inactivity and returns to login', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-25T12:00:00') });
  await login(page);
  await page.clock.runFor(16 * 60 * 1000);
  await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 20_000 });
});
