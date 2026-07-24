#!/usr/bin/env node
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';

type UserRole = 'admin' | 'supervisor' | 'user';
type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'manage' | 'approve' | 'export';
type AvisosAction = 'view' | 'create' | 'edit' | 'delete' | 'manage';
type PermissionDepartment =
  | 'usuarios'
  | 'reuniones'
  | 'limpieza'
  | 'departments'
  | 'predicacion'
  | 'tesoreria'
  | 'pagos'
  | 'configuracion'
  | 'avisos'
  | 'asignaciones'
  | 'acomodadores_microfonos'
  | 'organigrama';
type ServicePosition = 'coordinador' | 'secretario' | 'encargado' | 'auxiliar' | 'apoyo';
type ServiceDepartment =
  | 'coordinacion'
  | 'secretaria'
  | 'limpieza'
  | 'literatura'
  | 'tesoreria'
  | 'mantenimiento'
  | 'discursos'
  | 'reuniones'
  | 'predicacion'
  | 'territorios'
  | 'asignaciones'
  | 'hospitalidad'
  | 'usuarios'
  | 'configuracion'
  | 'audio_video'
  | 'acomodadores_microfonos';

type DepartmentPermissions = Partial<Record<PermissionAction, boolean>> & {
  territories?: Partial<Record<string, boolean>>;
  manageTerritories?: boolean;
};
type UserPermissions = Partial<Record<PermissionDepartment, DepartmentPermissions>>;

type ServiceAssignment = {
  position?: ServicePosition | string;
  department?: ServiceDepartment | string;
};

type AuditUser = {
  uid: string;
  email?: string;
  displayName?: string;
  role?: UserRole | string;
  isActive?: boolean;
  congregationId?: string;
  servicePosition?: ServicePosition | string;
  serviceDepartment?: ServiceDepartment | string;
  serviceAssignments?: ServiceAssignment[];
  permissions?: UserPermissions;
};

type AccessResult = {
  canManageEvents: boolean;
  wouldPassAssertEventManager: boolean;
  avisos: Record<AvisosAction, boolean>;
};

type AuditRow = {
  uid: string;
  email: string | null;
  displayName: string | null;
  congregationId: string;
  isActive: boolean;
  role: string | null;
  servicePosition: string | null;
  serviceDepartment: string | null;
  serviceAssignments: ServiceAssignment[];
  old: AccessResult;
  next: AccessResult;
  delta: Delta;
};

type Delta = 'sin cambio' | 'GANA acceso' | 'PIERDE acceso';
type OutputFormat = 'json' | 'csv';

type CliOptions = {
  format: OutputFormat;
  out?: string;
  projectId?: string;
  congregationId?: string;
  includeInactive: boolean;
  onlyDiff: boolean;
  pretty: boolean;
  help: boolean;
};

type FirestoreDoc = {
  id: string;
  data(): Record<string, unknown>;
};

type FirestoreQuerySnapshot = {
  docs: FirestoreDoc[];
};

type FirestoreQuery = {
  where(fieldPath: string, opStr: '==', value: string): FirestoreQuery;
  get(): Promise<FirestoreQuerySnapshot>;
};

type Firestore = {
  collection(path: string): FirestoreQuery;
};

type FirebaseAppModule = {
  initializeApp(options?: Record<string, unknown>): unknown;
  getApps(): unknown[];
  applicationDefault(): unknown;
};

type FirebaseFirestoreModule = {
  getFirestore(app?: unknown): Firestore;
};

const PERMISSION_DEPARTMENTS: PermissionDepartment[] = [
  'usuarios',
  'reuniones',
  'limpieza',
  'departments',
  'predicacion',
  'tesoreria',
  'pagos',
  'configuracion',
  'avisos',
  'asignaciones',
  'acomodadores_microfonos',
  'organigrama',
];

const PERMISSION_ACTIONS: PermissionAction[] = [
  'view',
  'create',
  'edit',
  'delete',
  'manage',
  'approve',
  'export',
];

const AVISOS_ACTIONS: AvisosAction[] = ['view', 'create', 'edit', 'delete', 'manage'];

const FULL_DEPARTMENT_PERMISSIONS = {
  view: true,
  create: true,
  edit: true,
  delete: true,
  manage: true,
  approve: true,
  export: true,
} satisfies Record<PermissionAction, boolean>;

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    format: 'json',
    includeInactive: true,
    onlyDiff: false,
    pretty: true,
    help: false,
  };

  argv.forEach((arg) => {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      return;
    }
    if (arg === '--csv') {
      options.format = 'csv';
      return;
    }
    if (arg === '--json') {
      options.format = 'json';
      return;
    }
    if (arg === '--only-diff') {
      options.onlyDiff = true;
      return;
    }
    if (arg === '--active-only') {
      options.includeInactive = false;
      return;
    }
    if (arg === '--compact') {
      options.pretty = false;
      return;
    }

    const [key, value] = arg.split('=', 2);
    if (!value) return;
    if (key === '--format' && (value === 'json' || value === 'csv')) options.format = value;
    if (key === '--out') options.out = value;
    if (key === '--project') options.projectId = value;
    if (key === '--congregation') options.congregationId = value;
  });

  return options;
};

const printHelp = (): void => {
  console.log(`
Dry-run events permission convergence audit.

Reads /congregations and /users, then compares:
  old = role-only gate used by assertEventManager today (admin or supervisor)
  next = canManageEvents() ported from src/utils/permissions/permissions.ts:409,
         including the effective 'avisos' permission derived from
         serviceAssignments (assignmentToPermissions), for this report only

Usage:
  npx -y tsx scripts/audit/events-access-dryrun.ts --format=json --out=tmp/events-access.json
  npx -y tsx scripts/audit/events-access-dryrun.ts --format=csv --out=tmp/events-access.csv

Options:
  --project=<projectId>       Optional Firebase project id for firebase-admin.
  --congregation=<id>         Limit the audit to one congregation.
  --format=json|csv           Output format. Default: json.
  --out=<path>                Write output to a file instead of stdout.
  --only-diff                 Include only rows where old and next differ.
  --active-only               Exclude inactive users from rows.
  --compact                   Compact JSON output.
  --help                      Show this help.

Credentials:
  Use Application Default Credentials, for example:
  $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\\\secure\\\\service-account.json"
`);
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const normalizeRole = (value: unknown): UserRole | undefined => {
  if (value === 'admin' || value === 'supervisor' || value === 'user') return value;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'administrador') return 'admin';
  if (normalized === 'usuario') return 'user';
  return undefined;
};

const normalizePermissions = (value: unknown): UserPermissions | undefined => {
  const source = asRecord(value);
  if (!source) return undefined;

  return PERMISSION_DEPARTMENTS.reduce<UserPermissions>((permissions, department) => {
    const departmentSource = asRecord(source[department]);
    if (!departmentSource) return permissions;

    const normalized: DepartmentPermissions = {};
    PERMISSION_ACTIONS.forEach((action) => {
      if (departmentSource[action] === true) normalized[action] = true;
    });
    permissions[department] = normalized;
    return permissions;
  }, {});
};

const normalizeAssignment = (value: unknown): ServiceAssignment | null => {
  const source = asRecord(value);
  if (!source) return null;

  const position = asString(source.position);
  const department = asString(source.department);
  if (!position && !department) return null;

  return {
    ...(position ? { position } : {}),
    ...(department ? { department } : {}),
  };
};

const normalizeUser = (doc: FirestoreDoc, congregationId: string): AuditUser => {
  const data = doc.data();
  const serviceAssignments = Array.isArray(data.serviceAssignments)
    ? data.serviceAssignments
        .map(normalizeAssignment)
        .filter((assignment): assignment is ServiceAssignment => assignment !== null)
    : undefined;

  return {
    uid: doc.id,
    email: asString(data.email),
    displayName: asString(data.displayName),
    role: normalizeRole(data.role),
    isActive: data.isActive === true,
    congregationId: asString(data.congregationId) ?? congregationId,
    servicePosition: asString(data.servicePosition),
    serviceDepartment: asString(data.serviceDepartment),
    serviceAssignments,
    permissions: normalizePermissions(data.permissions),
  };
};

// A partir de aqui, la logica de derivacion de permisos efectivos es una copia
// deliberada de src/utils/permissions/permissions.ts (getDefaultPermissionsByRole,
// assignmentToPermissions, mergePermissions, mirrorOrgChartPermissions). El script
// corre en Node con firebase-admin, no en Expo, y no puede importar desde src/.

const fullPermissions = (): UserPermissions =>
  PERMISSION_DEPARTMENTS.reduce<UserPermissions>((permissions, department) => {
    permissions[department] = { ...FULL_DEPARTMENT_PERMISSIONS };
    return permissions;
  }, {});

const getDefaultPermissionsByRole = (role: UserRole | string | undefined): UserPermissions => {
  if (role === 'admin') return fullPermissions();
  if (role === 'user') {
    return {
      reuniones: { view: true },
      avisos: { view: true },
      predicacion: { create: true },
    };
  }
  return {};
};

const mergePermissions = (...permissionSets: (UserPermissions | null | undefined)[]): UserPermissions =>
  permissionSets.reduce<UserPermissions>((merged, permissions) => {
    if (!permissions) return merged;

    PERMISSION_DEPARTMENTS.forEach((department) => {
      const departmentPermissions = permissions[department];
      if (!departmentPermissions) return;

      const target = merged[department] ?? {};
      PERMISSION_ACTIONS.forEach((action) => {
        if (departmentPermissions[action] === true) target[action] = true;
      });
      merged[department] = target;
    });

    return merged;
  }, {});

const assignmentToPermissions = (assignment: ServiceAssignment): UserPermissions => {
  if (assignment.position === 'encargado' && assignment.department === 'limpieza') {
    return { limpieza: { view: true, create: true, edit: true, delete: true, manage: true } };
  }
  if (assignment.position === 'auxiliar' && assignment.department === 'limpieza') {
    return { limpieza: { view: true, edit: true } };
  }
  if (assignment.position === 'encargado' && assignment.department === 'tesoreria') {
    return {
      tesoreria: { view: true, create: true, edit: true, delete: true, manage: true },
      pagos: { view: true, create: true, approve: true, manage: true },
    };
  }
  if (assignment.position === 'auxiliar' && assignment.department === 'tesoreria') {
    return {
      tesoreria: { view: true, create: true, edit: true },
      pagos: { view: true },
    };
  }
  if (
    assignment.position === 'encargado' &&
    (assignment.department === 'predicacion' || assignment.department === 'territorios')
  ) {
    return { predicacion: { view: true, approve: true, export: true, manage: true } };
  }
  if (
    assignment.position === 'auxiliar' &&
    (assignment.department === 'predicacion' || assignment.department === 'territorios')
  ) {
    return { predicacion: { view: true, export: true } };
  }
  if (assignment.position === 'encargado' && assignment.department === 'reuniones') {
    return { reuniones: { view: true, create: true, edit: true, delete: true, manage: true } };
  }
  if (assignment.position === 'auxiliar' && assignment.department === 'reuniones') {
    return { reuniones: { view: true, edit: true } };
  }
  if (assignment.position === 'encargado' && assignment.department === 'discursos') {
    return { asignaciones: { view: true, create: true, edit: true, delete: true, manage: true } };
  }
  if (assignment.position === 'auxiliar' && assignment.department === 'discursos') {
    return { asignaciones: { view: true, edit: true } };
  }
  if (assignment.position === 'encargado' && assignment.department === 'acomodadores_microfonos') {
    return {
      acomodadores_microfonos: { view: true, create: true, edit: true, manage: true },
      asignaciones: { view: true, create: true, edit: true, manage: true },
      reuniones: { view: true, edit: true },
    };
  }
  if (assignment.position === 'auxiliar' && assignment.department === 'acomodadores_microfonos') {
    return {
      acomodadores_microfonos: { view: true, edit: true },
      asignaciones: { view: true, edit: true },
      reuniones: { view: true, edit: true },
    };
  }
  return {};
};

const getPermissionsFromServiceAssignments = (user: AuditUser): UserPermissions => {
  const assignments: ServiceAssignment[] = [
    ...(user.servicePosition
      ? [{ position: user.servicePosition, department: user.serviceDepartment }]
      : []),
    ...(user.serviceAssignments ?? []),
  ];

  return mergePermissions(...assignments.map(assignmentToPermissions));
};

const mirrorOrgChartPermissions = (permissions: UserPermissions): UserPermissions => {
  const aliases: PermissionDepartment[] = ['departments', 'organigrama'];
  const union: DepartmentPermissions = {};
  let hasAny = false;

  aliases.forEach((department) => {
    const source = permissions[department];
    if (!source) return;
    PERMISSION_ACTIONS.forEach((action) => {
      if (source[action] === true) {
        union[action] = true;
        hasAny = true;
      }
    });
  });

  if (!hasAny) return permissions;
  aliases.forEach((department) => {
    permissions[department] = { ...(permissions[department] ?? {}), ...union };
  });
  return permissions;
};

const getEffectivePermissions = (user: AuditUser): UserPermissions =>
  mirrorOrgChartPermissions(
    mergePermissions(
      getDefaultPermissionsByRole(user.role),
      user.permissions,
      getPermissionsFromServiceAssignments(user)
    )
  );

const hasAvisosPermission = (
  permissions: UserPermissions,
  action: AvisosAction
): boolean =>
  permissions.avisos?.[action] === true || permissions.avisos?.manage === true;

// Espejo de canManageEvents() de src/utils/permissions/permissions.ts:409.
const canManageEvents = (
  user: AuditUser,
  hasAvisos: (action: AvisosAction) => boolean
): boolean =>
  user.role === 'admin' ||
  hasAvisos('manage') ||
  (hasAvisos('create') && hasAvisos('edit'));

// Gate real de hoy en functions/src/events.ts:207 (assertEventManager): solo rol.
const isOldEventManagerByRole = (user: AuditUser): boolean =>
  user.role === 'admin' || user.role === 'supervisor';

const accessResult = (
  user: AuditUser,
  congregationId: string,
  roleGate: boolean,
  hasAvisos: (action: AvisosAction) => boolean
): AccessResult => {
  const canManage = roleGate || canManageEvents(user, hasAvisos);
  const assertGate = user.isActive === true && user.congregationId === congregationId;

  return {
    canManageEvents: canManage,
    wouldPassAssertEventManager: assertGate && canManage,
    avisos: AVISOS_ACTIONS.reduce<Record<AvisosAction, boolean>>((acc, action) => {
      acc[action] = hasAvisos(action);
      return acc;
    }, {} as Record<AvisosAction, boolean>),
  };
};

const buildDelta = (oldValue: boolean, nextValue: boolean): Delta => {
  if (oldValue === nextValue) return 'sin cambio';
  return nextValue ? 'GANA acceso' : 'PIERDE acceso';
};

const toAuditRow = (user: AuditUser, congregationId: string): AuditRow => {
  // "old" es el gate REAL de hoy: solo rol, ignora permissions.avisos por completo.
  const old = accessResult(user, congregationId, isOldEventManagerByRole(user), () => false);
  // "next" es canManageEvents() del frontend, con avisos resuelto vía permisos
  // efectivos (rol + permissions explicitos + derivados de serviceAssignments).
  const effectivePermissions = getEffectivePermissions(user);
  const next = accessResult(
    user,
    congregationId,
    false,
    (action) => hasAvisosPermission(effectivePermissions, action)
  );

  return {
    uid: user.uid,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    congregationId,
    isActive: user.isActive === true,
    role: user.role ?? null,
    servicePosition: user.servicePosition ?? null,
    serviceDepartment: user.serviceDepartment ?? null,
    serviceAssignments: user.serviceAssignments ?? [],
    old,
    next,
    delta: buildDelta(old.wouldPassAssertEventManager, next.wouldPassAssertEventManager),
  };
};

const summarizeDelta = (rows: AuditRow[]) => ({
  gana: rows.filter((row) => row.delta === 'GANA acceso').length,
  pierde: rows.filter((row) => row.delta === 'PIERDE acceso').length,
  sinCambio: rows.filter((row) => row.delta === 'sin cambio').length,
});

const buildSummary = (rows: AuditRow[]) => {
  const activeRows = rows.filter((row) => row.isActive);

  return {
    generatedAt: new Date().toISOString(),
    usersAudited: rows.length,
    activeUsersAudited: activeRows.length,
    delta: summarizeDelta(rows),
    activeDelta: summarizeDelta(activeRows),
  };
};

const csvEscape = (value: string | number | boolean | null): string => {
  const text = value === null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const toCsv = (rows: AuditRow[]): string => {
  const headers = [
    'uid',
    'congregationId',
    'isActive',
    'role',
    'email',
    'displayName',
    'servicePosition',
    'serviceDepartment',
    'oldCanManageEvents',
    'newCanManageEvents',
    'delta',
    'oldAvisosManage',
    'newAvisosManage',
    'oldAvisosCreate',
    'newAvisosCreate',
    'oldAvisosEdit',
    'newAvisosEdit',
  ];

  const lines = rows.map((row) =>
    [
      row.uid,
      row.congregationId,
      row.isActive,
      row.role,
      row.email,
      row.displayName,
      row.servicePosition,
      row.serviceDepartment,
      row.old.wouldPassAssertEventManager,
      row.next.wouldPassAssertEventManager,
      row.delta,
      row.old.avisos.manage,
      row.next.avisos.manage,
      row.old.avisos.create,
      row.next.avisos.create,
      row.old.avisos.edit,
      row.next.avisos.edit,
    ].map(csvEscape).join(',')
  );

  return [headers.join(','), ...lines].join('\n');
};

const loadFirebaseAdmin = (): { app: FirebaseAppModule; firestore: FirebaseFirestoreModule } => {
  const functionsPackageJson = resolve(process.cwd(), 'functions/package.json');
  const requireFromFunctions = createRequire(pathToFileURL(functionsPackageJson));

  return {
    app: requireFromFunctions('firebase-admin/app') as FirebaseAppModule,
    firestore: requireFromFunctions('firebase-admin/firestore') as FirebaseFirestoreModule,
  };
};

const getDb = (options: CliOptions): Firestore => {
  const { app, firestore } = loadFirebaseAdmin();
  const existingApps = app.getApps();
  const appOptions: Record<string, unknown> = {};

  if (options.projectId) appOptions.projectId = options.projectId;
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    appOptions.credential = app.applicationDefault();
  }

  const firebaseApp = existingApps[0] ?? app.initializeApp(appOptions);
  return firestore.getFirestore(firebaseApp);
};

const listCongregationIds = async (
  db: Firestore,
  congregationId?: string
): Promise<string[]> => {
  if (congregationId) return [congregationId];
  const snap = await db.collection('congregations').get();
  return snap.docs.map((doc) => doc.id).sort();
};

const loadRows = async (db: Firestore, options: CliOptions): Promise<AuditRow[]> => {
  const congregationIds = await listCongregationIds(db, options.congregationId);
  const rows: AuditRow[] = [];

  for (const congregationId of congregationIds) {
    const usersSnap = await db.collection('users').where('congregationId', '==', congregationId).get();
    usersSnap.docs.forEach((doc) => {
      const user = normalizeUser(doc, congregationId);
      if (!options.includeInactive && user.isActive !== true) return;
      const row = toAuditRow(user, congregationId);
      if (!options.onlyDiff || row.delta !== 'sin cambio') rows.push(row);
    });
  }

  return rows;
};

const render = (rows: AuditRow[], options: CliOptions): string => {
  if (options.format === 'csv') return toCsv(rows);

  const payload = {
    summary: buildSummary(rows),
    rows,
  };
  return JSON.stringify(payload, null, options.pretty ? 2 : 0);
};

const writeOutput = async (output: string, options: CliOptions): Promise<void> => {
  if (!options.out) {
    console.log(output);
    return;
  }

  await mkdir(dirname(resolve(options.out)), { recursive: true });
  await writeFile(options.out, output, 'utf8');
  console.error(`Wrote ${options.format.toUpperCase()} audit to ${options.out}`);
};

const main = async (): Promise<void> => {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const db = getDb(options);
  const rows = await loadRows(db, options);
  await writeOutput(render(rows, options), options);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`events-access-dryrun failed: ${message}`);
  process.exitCode = 1;
});
