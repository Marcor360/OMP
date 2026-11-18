import { test, expect, type Page } from '@playwright/test';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
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
      isActive: true,
      active: true,
      enabled: true,
      disabled: false,
      deactivated: false,
      accessDisabled: false,
      status: 'active',
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

test('opens and navigates the assignment calendar by keyboard on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/assignments/create');
  const openCalendar = page.getByRole('button', { name: 'Seleccionar fecha' });
  await openCalendar.focus();
  await openCalendar.press('Enter');

  const next = page.getByRole('button', { name: 'Mes siguiente' });
  await expect(next).toBeVisible();
  await next.focus();
  await next.press('Enter');
  await expect(page.getByRole('button', { name: 'Mes anterior' })).toBeEnabled();

  await page.getByRole('button', { name: 'Cerrar' }).click();
  await expect(next).toBeHidden();
  await expect(openCalendar).toBeVisible();
});

test('keeps a draft assignment description when the connection drops and returns', async ({ page, context }) => {
  await login(page);
  await page.goto('/assignments/create');
  const description = page.getByPlaceholder('Detalles de la tarea...');
  await description.fill('Borrador local');
  await context.setOffline(true);
  try {
    await description.fill('Borrador local sin conexión');
    await expect(description).toHaveValue('Borrador local sin conexión');
    await expect(page.getByText('Asignacion creada correctamente.')).toHaveCount(0);
  } finally {
    await context.setOffline(false);
  }
  await expect(description).toHaveValue('Borrador local sin conexión');
});

test('reports a failed assignment write and persists once after reconnecting', async ({ page }) => {
  const meetingPath = 'congregations/e2e-congregation/meetings/offline-write';
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(12, 0, 0, 0);
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), meetingPath), {
      type: 'midweek',
      meetingCategory: 'midweek',
      title: 'Reunión de prueba sin conexión',
      startDate: date,
      endDate: date,
      meetingDate: date,
      publicationStatus: 'awaiting_assignments',
    });
  });
  const verifyCount = (expected: number) => environment.withSecurityRulesDisabled(async (context) => {
    expect((await getDocs(collection(context.firestore(), `${meetingPath}/assignments`))).size).toBe(expected);
  });

  await login(page);
  await page.goto('/assignments/create');
  await page.getByText('Manual', { exact: true }).click();
  await page.getByPlaceholder('Nombre de la persona').fill('Asignación de prueba');
  const description = page.getByPlaceholder('Detalles de la tarea...');
  await description.fill('Escritura de prueba');
  const save = page.getByRole('button', { name: 'Crear asignación' });

  await expect(save).toBeEnabled();
  const writeUrl = '**/createMeetingAssignmentByManager';
  await page.route(writeUrl, (route) => route.abort('internetdisconnected'));
  const saveWithDialog = async () => {
    let message = '';
    const observed = page.waitForEvent('dialog').then(async (dialog) => {
      message = dialog.message();
      await dialog.accept();
    });
    await save.click();
    await observed;
    return message;
  };
  expect(await saveWithDialog()).toMatch(/^Error/);
  await expect(description).toHaveValue('Escritura de prueba');
  await verifyCount(0);

  await page.unroute(writeUrl);
  expect(await saveWithDialog()).toContain('Asignacion creada correctamente.');
  await verifyCount(1);
});
