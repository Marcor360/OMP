import { test as base, expect, type Page } from '@playwright/test';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const projectId = 'demo-omp';
const authOrigin = 'http://127.0.0.1:9099';
type AdminScenario = {
  uid: string;
  email: string;
  password: string;
  congregationId: string;
};

const seedActor = async (
  environment: RulesTestEnvironment, role: 'admin' | 'user' = 'admin',
): Promise<AdminScenario> => {
  const suffix = randomUUID();
  const congregationId = `e2e-congregation-${suffix}`;
  const credentials = { email: `e2e-${suffix}@example.invalid`, password: 'E2e-pass-2026!' };
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
      congregationId,
      role,
      isActive: true,
      status: 'active',
      displayName: role === 'admin' ? 'E2E Admin' : 'E2E Member',
      email: credentials.email,
      serviceAssignments: [],
      permissions: {},
      privileges: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(database, 'congregations', congregationId), {
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
  return { ...credentials, congregationId, uid: localId };
};

const test = base.extend<{ adminScenario: AdminScenario }, { environment: RulesTestEnvironment }>({
  // Playwright requires a destructured fixture dependency argument.
  // eslint-disable-next-line no-empty-pattern
  environment: [async ({}, provide) => {
    const environment = await initializeTestEnvironment({
      projectId,
      firestore: { host: '127.0.0.1', port: 9085, rules: await readFile('firestore.rules', 'utf8') },
    });
    try {
      await provide(environment);
    } finally {
      await environment.cleanup();
    }
  }, { scope: 'worker' }],
  adminScenario: async ({ environment }, provide) => {
    await provide(await seedActor(environment));
  },
});

const login = async (page: Page, credentials: AdminScenario, language: 'es' | 'en' = 'es') => {
  await page.addInitScript((locale) => {
    localStorage.setItem('@omp/language', locale);
    localStorage.setItem('@omp/language-onboarding-complete', '1');
  }, language);
  await page.goto('/login');
  await page.getByPlaceholder(language === 'es' ? 'tu@email.com' : 'you@example.com').fill(credentials.email);
  await page.getByPlaceholder('********').fill(credentials.password);
  await page.getByRole('button', { name: /iniciar sesión|iniciar sesion|sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 20_000 });
};

test('login uses the Auth emulator and opens the protected app', async ({ page, adminScenario }) => {
  await login(page, adminScenario);
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
});

test('uses English in the login and assignment form', async ({ page, adminScenario }) => {
  await login(page, adminScenario, 'en');
  await page.goto('/assignments/create');
  await expect(page.getByText('New assignment', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByPlaceholder('Task details...')).toBeVisible();
  await expect(page.getByText('General cleaning', { exact: true })).toBeVisible();
  await expect(page.getByText('Tipo de asignación', { exact: true })).toHaveCount(0);
});

test('downloads the monthly preaching summary and non-executable CSV details', async ({ page, adminScenario, environment }) => {
  const now = new Date();
  const monthId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const parent = `congregations/${adminScenario.congregationId}/preachingReports/${monthId}`;
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await setDoc(doc(database, 'users', adminScenario.uid), {
      serviceDepartment: 'predicacion', servicePosition: 'encargado', privileges: { isElder: true },
    }, { merge: true });
    await setDoc(doc(database, `${parent}/submissions/synthetic`), {
      userId: 'synthetic',
      userName: '=1+1',
      congregationId: adminScenario.congregationId,
      monthId,
      participated: true,
      bibleStudies: 2,
      returnVisits: 0,
      comments: 'private-comment-for-test',
      isPioneer: false,
      submittedAt: now,
      updatedAt: now,
    });
  });

  await login(page, adminScenario, 'en');
  await page.goto('/preaching/manager');
  const detailButton = page.getByRole('button', { name: 'Download CSV details' });
  await expect(detailButton).toBeVisible({ timeout: 15_000 });
  const [detail] = await Promise.all([page.waitForEvent('download'), detailButton.click()]);
  expect(detail.suggestedFilename()).toBe(`preaching-detail-${monthId}.csv`);
  const detailText = await readFile(await detail.path(), 'utf8');
  expect(detailText).toContain('"\'=1+1"');
  expect(detailText).not.toContain('private-comment-for-test');

  const [summary] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download CSV summary' }).click(),
  ]);
  expect(summary.suggestedFilename()).toBe(`preaching-summary-${monthId}.csv`);
  expect(await readFile(await summary.path(), 'utf8')).toContain('"Metric","Value"');
});

test('keeps the assignment editor unavailable to an ordinary member', async ({ page, environment }) => {
  await login(page, await seedActor(environment, 'user'), 'en');
  await page.goto('/assignments/create');
  await expect(page.getByText('You do not have permission to create or edit assignments.')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Create assignment' })).toHaveCount(0);
});

test('session expires after inactivity and returns to login', async ({ page, adminScenario }) => {
  // The emulator issues tokens using the host clock.
  await page.clock.install();
  await login(page, adminScenario);
  await expect(page.getByRole('tab', { name: /inicio/i })).toBeVisible({ timeout: 15_000 });
  await page.clock.fastForward(16 * 60 * 1000);
  await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 20_000 });
});

test('opens and navigates the assignment calendar by keyboard on a narrow screen', async ({ page, adminScenario }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, adminScenario);
  await page.goto('/assignments/create');
  const openCalendar = page.getByRole('button', { name: 'Seleccionar fecha' });
  await openCalendar.focus();
  await openCalendar.press('Enter');

  const calendar = page.getByRole('dialog');
  const next = calendar.getByRole('button', { name: 'Mes siguiente' });
  await expect(next).toBeEnabled();
  await next.focus();
  await expect(next).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(calendar.getByRole('button', { name: 'Mes anterior' })).toBeEnabled();

  await calendar.getByRole('button', { name: 'Cerrar' }).click();
  await expect(next).toBeHidden();
  await expect(openCalendar).toBeVisible();
});

test('keeps a draft assignment description when the connection drops and returns', async ({ page, context, adminScenario }) => {
  await login(page, adminScenario);
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

test('reports a failed assignment write and persists once after reconnecting', async ({ page, adminScenario, environment }) => {
  const meetingPath = `congregations/${adminScenario.congregationId}/meetings/offline-write`;
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

  await login(page, adminScenario);
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
  await page.route(writeUrl, async (route) => {
    await route.fetch();
    await route.abort('internetdisconnected');
  }, { times: 1 });
  expect(await saveWithDialog()).toMatch(/^Error/);
  await expect(description).toHaveValue('Escritura de prueba');
  await verifyCount(1);

  await description.fill('Edición tras una respuesta perdida');
  expect(await saveWithDialog()).toContain('El intento anterior ya guardó una asignación.');
  await verifyCount(1);

  await description.fill('Escritura de prueba');
  expect(await saveWithDialog()).toContain('Asignacion creada correctamente.');
  await verifyCount(1);
});

for (const committed of [true, false]) {
  test(`recovers an assignment after reload when the original write ${committed ? 'committed' : 'never reached the server'}`, async ({ page, adminScenario, environment }) => {
    const meetingPath = `congregations/${adminScenario.congregationId}/meetings/reload-write`;
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(12, 0, 0, 0);
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), meetingPath), {
        type: 'midweek', meetingCategory: 'midweek', title: 'Reunión de recuperación',
        startDate: date, endDate: date, meetingDate: date, publicationStatus: 'awaiting_assignments',
      });
    });
    await login(page, adminScenario);
    await page.goto('/assignments/create');
    await page.getByText('Manual', { exact: true }).click();
    await page.getByPlaceholder('Nombre de la persona').fill('Persona de recuperación');
    await page.route('**/createMeetingAssignmentByManager', async (route) => {
      if (committed) {
        const result = await route.fetch();
        expect(result.ok()).toBe(true);
      }
      await route.abort('internetdisconnected');
    }, { times: 1 });

    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Crear asignación' }).click();
    await expect(page.getByRole('button', { name: 'Crear asignación' })).toBeEnabled();

    const assignmentQueries = new Set<string>();
    const queryPrefix = `[FirestoreIO] read source=server key=assignments-panel/${adminScenario.congregationId}/`;
    page.on('console', (message) => {
      if (message.text().includes(queryPrefix)) assignmentQueries.add(message.text().split(queryPrefix)[1]);
    });
    await page.goto('/assignments');
    if (!committed) {
      await page.getByRole('button', { name: 'Comprobar y reintentar' }).click();
    }
    await expect(page.getByText('Guardado confirmado', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => assignmentQueries.size).toBe(3);
    await page.getByRole('button', { name: 'Entendido', exact: true }).click();
    await expect(page.getByText('Guardado confirmado', { exact: true })).toBeHidden();
    await environment.withSecurityRulesDisabled(async (context) => {
      expect((await getDocs(collection(context.firestore(), `${meetingPath}/assignments`))).size).toBe(1);
    });
  });
}

test('retries a saved cleaning plan and shows history and possible duplicates', async ({ page, adminScenario, environment }) => {
  const meetingPath = `congregations/${adminScenario.congregationId}/meetings/operational-review`;
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(12, 0, 0, 0);
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await setDoc(doc(database, meetingPath), {
      type: 'midweek', meetingCategory: 'midweek', title: 'Reunión para revisión',
      startDate: date, endDate: date, meetingDate: date, publicationStatus: 'awaiting_assignments',
      cleaningAssignmentMode: 'selected', cleaningGroupIds: ['group-one'],
      cleaningGroupNames: ['Grupo guardado'], cleaningSyncPending: true,
    });
    await setDoc(doc(database, `${meetingPath}/changeLogs/edit`), {
      changedSections: [{ key: 'opening', title: 'Apertura', change: 'updated' }],
      changedBy: 'another-editor', createdAt: date,
    });
    for (const id of ['first-task', 'second-task']) {
      await setDoc(doc(database, `${meetingPath}/assignments/${id}`), {
        category: 'platform', title: 'Lectura similar', assignedToName: 'Persona de prueba',
        assignedToUid: 'manual:persona-de-prueba', dueDate: date,
      });
    }
  });

  await login(page, adminScenario);
  await page.goto('/meetings/manage');
  const retry = page.getByRole('button', { name: 'Limpieza pendiente · Reintentar' });
  await expect(retry).toBeVisible({ timeout: 15_000 });
  await retry.click();
  await expect(retry).toBeHidden({ timeout: 15_000 });
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    expect((await getDoc(doc(database, meetingPath))).get('cleaningSyncPending')).toBe(false);
    expect((await getDoc(doc(database, `${meetingPath}/assignments/cleaning-group-one`))).exists()).toBe(true);
  });

  await page.goto('/assignments/review');
  await page.getByRole('button', { name: /Reunión para revisión/ }).click();
  await expect(page.getByText(/Lectura similar ·/)).toHaveCount(2);
  await expect(page.getByText('Se revisaron 3 asignaciones de esta reunión. El límite es 200.')).toBeVisible();
  await page.getByRole('button', { name: 'Pendiente', exact: true }).click();
  await expect(page.getByText(/Lectura similar ·/)).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Todas las fechas', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Historial de cambios' }).click();
  await expect(page.getByText('Apertura · Modificada')).toBeVisible();
  await expect(page.getByText(/Otro editor/)).toBeVisible();
});
