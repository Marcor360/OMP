import { test, expect, type Page } from '@playwright/test';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectId = 'demo-omp';
const congregationId = 'gallery-demo';
const authOrigin = 'http://127.0.0.1:9099';
const galleryDir = resolve('tmp/omp-gallery');
const desktop = { width: 1440, height: 1000 };
const mobile = { width: 390, height: 844 };
let environment: RulesTestEnvironment;

test.beforeAll(async () => {
  // No credentials, production project, or remote Firestore host are accepted.
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 9085,
      rules: await readFile('firestore.rules', 'utf8'),
    },
  });
  await mkdir(galleryDir, { recursive: true });
});
test.afterAll(async () => { await environment?.cleanup(); });

test.beforeEach(async ({ context }) => {
  // Prevent the browser from contacting production or third-party HTTP services.
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) {
      await route.continue();
    } else {
      await route.abort();
    }
  });
});

async function preferences(page: Page, theme: 'light' | 'dark') {
  await page.addInitScript(({ mode }) => {
    localStorage.setItem('@omp/language', 'es');
    localStorage.setItem('@omp/language-onboarding-complete', '1');
    localStorage.setItem('@omp/theme-mode', mode);
    localStorage.setItem('omp_welcome_notice_dismissed_v1', '1');
  }, { mode: theme });
}

async function capture(page: Page, name: string) {
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.screenshot({
    path: resolve(galleryDir, name + '.png'),
    animations: 'disabled',
    caret: 'hide',
  });
}

async function seedDemo() {
  const email = 'galeria-' + Date.now() + '-' + Math.random().toString(16).slice(2) + '@example.invalid';
  const password = 'Demo-only-2026!';
  const response = await fetch(authOrigin + '/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!response.ok) throw new Error('Auth emulator seed failed: ' + response.status);
  const { localId } = await response.json() as { localId: string };
  const date = (days: number, hour: number) => {
    const value = new Date();
    value.setDate(value.getDate() + days);
    value.setHours(hour, 0, 0, 0);
    return Timestamp.fromDate(value);
  };
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'congregations', congregationId), {
      name: 'Congregación Demo', isActive: true,
      activeUsersLimit: 80, plan: { key: 'omp_80', activeUsersLimit: 80 },
      billing: { enabled: false },
    });
    await setDoc(doc(db, 'users', localId), {
      uid: localId, congregationId, email, displayName: 'Demo OMP',
      role: 'admin', isActive: true, status: 'active',
      serviceAssignments: [], permissions: {}, privileges: {},
      createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    });
    // Synthetic read-only dashboard projection; no production export is used.
    await setDoc(doc(db, 'dashboardSummary', congregationId), {
      congregationId,
      metrics: {
        totalUsers: 1, activeUsers: 1, totalMeetings: 2, scheduledMeetings: 2,
        totalAssignments: 3, pendingAssignments: 2, completedAssignments: 1, overdueAssignments: 0,
      },
      upcomingMeetings: [
        { id: 'demo-midweek', title: 'Reunión entre semana', type: 'midweek', meetingCategory: 'midweek', publicationStatus: 'published', startDate: date(3, 19), endDate: date(3, 21) },
        { id: 'demo-weekend', title: 'Reunión de fin de semana', type: 'weekend', meetingCategory: 'weekend', publicationStatus: 'published', startDate: date(6, 10), endDate: date(6, 12) },
      ],
      pendingAssignments: [
        { id: 'demo-mic', title: 'Micrófonos', status: 'pending', priority: 'medium', dueDate: date(3, 19), assignedToUid: localId, assignedToName: 'Demo OMP' },
        { id: 'demo-reader', title: 'Lectura', status: 'pending', priority: 'medium', dueDate: date(6, 10), assignedToUid: localId, assignedToName: 'Demo OMP' },
      ],
      generatedAt: Timestamp.now(), updatedAt: Timestamp.now(),
    });
  });
  return { email, password };
}

test('onboarding mobile', async ({ page }) => {
  await page.setViewportSize(mobile);
  await page.goto('/');
  await expect(page.getByText('Elige tu idioma', { exact: true })).toBeVisible({ timeout: 60_000 });
  await capture(page, '01-idioma-web-movil');
});

for (const [name, viewport, theme] of [
  ['02-acceso-web-escritorio', desktop, 'light'],
  ['03-acceso-web-movil-oscuro', mobile, 'dark'],
] as const) {
  test(name, async ({ page }) => {
    await page.setViewportSize(viewport);
    await preferences(page, theme);
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByPlaceholder('tu@email.com')).toHaveValue('');
    await expect(page.getByPlaceholder('********')).toHaveValue('');
    await capture(page, name);
  });
}

for (const [name, viewport, theme] of [
  ['04-dashboard-web-escritorio', desktop, 'light'],
  ['05-dashboard-web-movil-oscuro', mobile, 'dark'],
] as const) {
  test(name, async ({ page }) => {
    const credentials = await seedDemo();
    await page.setViewportSize(viewport);
    await preferences(page, theme);
    await page.goto('/login');
    await page.getByPlaceholder('tu@email.com').fill(credentials.email, { timeout: 60_000 });
    await page.getByPlaceholder('********').fill(credentials.password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByText('Congregación Demo', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Próximas reuniones', { exact: true })).toBeVisible();
    await capture(page, name);
  });
}
