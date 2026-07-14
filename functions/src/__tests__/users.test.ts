/**
 * Pruebas unitarias — Usuarios (Cloud Functions)
 *
 * Verifica los parsers de payload y helpers de validación que son
 * funciones puras o casi-puras (sin dependencia de Firestore/Auth).
 *
 * Los helpers bajo prueba se replican aquí porque son privados al módulo.
 * Si se exportan en el futuro, se puede importar directamente.
 */

import { HttpsError } from 'firebase-functions/v2/https';
import { stripOrgChartManageUnlessAuthorized } from '../users.js';
import {
  parsePermissions as parseStoredPermissions,
  parseServiceAssignments as parseStoredServiceAssignments,
} from '../users/parsers.js';

// ─── Helpers replicados ───────────────────────────────────────────────────────

type Role = 'admin' | 'supervisor' | 'user';

function assertValidRole(role: unknown): asserts role is Role {
  if (role !== 'admin' && role !== 'supervisor' && role !== 'user') {
    throw new HttpsError('invalid-argument', 'Rol invalido.');
  }
}

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

type ServicePosition = 'coordinador' | 'secretario' | 'encargado' | 'auxiliar';
type ServiceDepartment = 'limpieza';
type UserPrivileges = {
  isElder?: boolean;
  isMinisterialServant?: boolean;
  isRegularPioneer?: boolean;
  isAuxiliaryPioneer?: boolean;
};
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
  | 'organigrama';
type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'manage' | 'approve' | 'export';
type TerritoryPermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'assign' | 'manage';

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

const TERRITORY_PERMISSION_ACTIONS: TerritoryPermissionAction[] = [
  'view',
  'create',
  'edit',
  'delete',
  'assign',
  'manage',
];

const parseServicePosition = (value: unknown): ServicePosition | undefined => {
  const text = normalizeText(value);
  if (!text) return undefined;
  if (
    text === 'coordinador' ||
    text === 'secretario' ||
    text === 'encargado' ||
    text === 'auxiliar'
  ) {
    return text;
  }
  throw new HttpsError('invalid-argument', 'Asignacion de servicio invalida.');
};

const requiresAdminElderPosition = (position?: ServicePosition): boolean =>
  position === 'coordinador' || position === 'secretario';

const rawServiceAssignmentsRequireAdminElder = (value: unknown): boolean => {
  if (!Array.isArray(value)) return false;

  return value.some((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return false;
    const position = parseServicePosition((item as Record<string, unknown>).position);
    return requiresAdminElderPosition(position);
  });
};

const ensureAdminElderPrivileges = (
  privileges: UserPrivileges | undefined,
  shouldRequire: boolean
): UserPrivileges | undefined =>
  shouldRequire
    ? {
      ...(privileges ?? {}),
      isElder: true,
      isMinisterialServant: false,
    }
    : privileges;

const buildServiceAssignmentLabel = (
  position?: ServicePosition,
  department?: ServiceDepartment
): string | undefined => {
  if (!position) return undefined;
  if (position === 'coordinador') return 'Coordinador';
  if (position === 'secretario') return 'Secretario';
  if (!department) return undefined;
  if (position === 'encargado') return 'Encargado de Limpieza';
  if (position === 'auxiliar') return 'Auxiliar de Limpieza';
  return undefined;
};

const normalizeStoredAssignmentForRole = (
  position?: ServicePosition,
  department?: ServiceDepartment
): { position: ServicePosition; department?: ServiceDepartment; label: string } | null => {
  const label = buildServiceAssignmentLabel(position, department);
  if (!position || !label) return null;
  const stored: { position: ServicePosition; department?: ServiceDepartment; label: string } = {
    position,
    label,
  };
  if (department) {
    stored.department = department;
  }
  return stored;
};

const parsePermissions = (
  value: unknown,
  options?: { strict?: boolean }
): Record<string, unknown> | undefined => {
  const strict = options?.strict !== false;
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    if (!strict) return undefined;
    throw new HttpsError('invalid-argument', 'Permisos invalidos.');
  }

  const source = value as Record<string, unknown>;
  const invalidDepartment = Object.keys(source).find(
    (department) => !PERMISSION_DEPARTMENTS.includes(department as PermissionDepartment)
  );
  if (invalidDepartment) {
    if (!strict) return source;
    throw new HttpsError('invalid-argument', 'Permisos contienen departamentos no permitidos.');
  }

  Object.entries(source).forEach(([department, rawDepartment]) => {
    if (typeof rawDepartment !== 'object' || rawDepartment === null || Array.isArray(rawDepartment)) {
      if (!strict) return;
      throw new HttpsError('invalid-argument', 'Permisos por departamento invalidos.');
    }

    const rawActions = rawDepartment as Record<string, unknown>;
    const invalidAction = Object.keys(rawActions).find(
      (action) =>
        !PERMISSION_ACTIONS.includes(action as PermissionAction) &&
        !(department === 'predicacion' && (action === 'territories' || action === 'manageTerritories'))
    );
    if (invalidAction) {
      if (!strict) return;
      throw new HttpsError('invalid-argument', 'Permisos contienen acciones no permitidas.');
    }

    if (department === 'predicacion' && rawActions.territories !== undefined) {
      if (
        typeof rawActions.territories !== 'object' ||
        rawActions.territories === null ||
        Array.isArray(rawActions.territories)
      ) {
        if (!strict) return;
        throw new HttpsError('invalid-argument', 'Permisos de territorios invalidos.');
      }

      const rawTerritories = rawActions.territories as Record<string, unknown>;
      const invalidTerritoryAction = Object.keys(rawTerritories).find(
        (action) => !TERRITORY_PERMISSION_ACTIONS.includes(action as TerritoryPermissionAction)
      );
      if (invalidTerritoryAction) {
        if (!strict) return;
        throw new HttpsError('invalid-argument', 'Permisos de territorios contienen acciones no permitidas.');
      }
    }

    if (department === 'predicacion' && rawActions.manageTerritories !== undefined) {
      if (typeof rawActions.manageTerritories !== 'boolean') {
        if (!strict) return;
        throw new HttpsError('invalid-argument', 'El permiso de administrar territorios debe ser booleano.');
      }
    }
  });

  return source;
};

// Simula parseCreateUserPayload con validaciones relevantes
function parseCreateUserPayload(raw: unknown): {
  firstName: string;
  lastName: string;
  role: Role;
  congregationId: string;
  password: string;
  gender?: 'masculino' | 'femenino';
  isActive: boolean;
} {
  if (typeof raw !== 'object' || raw === null) {
    throw new HttpsError('invalid-argument', 'Payload invalido.');
  }

  const data = raw as Record<string, unknown>;

  const firstName = normalizeText(data.firstName);
  const lastName = normalizeText(data.lastName);
  const congregationId = normalizeText(data.congregationId);
  const password = normalizeText(data.password);
  const displayName = normalizeText(data.displayName) ?? [firstName, lastName].filter(Boolean).join(' ');
  const gender =
    data.gender === 'masculino' || data.gender === 'femenino'
      ? data.gender
      : undefined;

  const missingFields = [
    !firstName ? 'primer nombre' : undefined,
    !lastName ? 'apellido paterno' : undefined,
    !displayName ? 'nombre completo' : undefined,
    !congregationId ? 'congregacion' : undefined,
    !password ? 'contrasena' : undefined,
  ].filter(Boolean);

  if (missingFields.length > 0) {
    throw new HttpsError(
      'invalid-argument',
      `Faltan datos requeridos para crear usuario: ${missingFields.join(', ')}.`
    );
  }

  const requiredFirstName = firstName as string;
  const requiredLastName = lastName as string;
  const requiredCongregationId = congregationId as string;
  const requiredPassword = password as string;

  assertValidRole(data.role);

  if (requiredPassword.length < 6) {
    throw new HttpsError('invalid-argument', 'La contrasena debe tener al menos 6 caracteres.');
  }

  return {
    firstName: requiredFirstName,
    lastName: requiredLastName,
    role: data.role,
    congregationId: requiredCongregationId,
    password: requiredPassword,
    gender,
    isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
  };
}

// ─── Tests: assertValidRole ───────────────────────────────────────────────────

describe('assertValidRole', () => {
  it.each(['admin', 'supervisor', 'user'])(
    'acepta el rol válido "%s"',
    (role) => {
      expect(() => assertValidRole(role)).not.toThrow();
    }
  );

  it.each(['administrador', 'ADMIN', 'moderator', '', null, undefined, 42])(
    'rechaza el rol inválido "%s"',
    (role) => {
      expect(() => assertValidRole(role)).toThrow(HttpsError);
    }
  );
});

// ─── Tests: parseServicePosition ─────────────────────────────────────────────

describe('parseServicePosition', () => {
  it.each(['coordinador', 'secretario', 'encargado', 'auxiliar'])(
    'acepta la posición válida "%s"',
    (pos) => {
      expect(parseServicePosition(pos)).toBe(pos);
    }
  );

  it('devuelve undefined para undefined/null/vacío', () => {
    expect(parseServicePosition(undefined)).toBeUndefined();
    expect(parseServicePosition(null)).toBeUndefined();
    expect(parseServicePosition('')).toBeUndefined();
  });

  it('lanza HttpsError para posición desconocida', () => {
    expect(() => parseServicePosition('director')).toThrow(HttpsError);
  });
});

// ─── Tests: parseCreateUserPayload ───────────────────────────────────────────

describe('coordinador/secretario requirements', () => {
  it.each(['coordinador', 'secretario'] as const)(
    'requiere rol admin y nombramiento de anciano para "%s"',
    (position) => {
      expect(requiresAdminElderPosition(position)).toBe(true);
      expect(ensureAdminElderPrivileges({ isMinisterialServant: true }, true)).toEqual({
        isElder: true,
        isMinisterialServant: false,
      });
    }
  );

  it('detecta Coordinador o Secretario en serviceAssignments crudos', () => {
    expect(
      rawServiceAssignmentsRequireAdminElder([{ position: 'secretario', label: 'Secretario' }])
    ).toBe(true);
    expect(
      rawServiceAssignmentsRequireAdminElder([{ position: 'encargado', label: 'Encargado' }])
    ).toBe(false);
  });

  it('omite department al guardar Coordinador o Secretario', () => {
    expect(normalizeStoredAssignmentForRole('coordinador')).toEqual({
      position: 'coordinador',
      label: 'Coordinador',
    });
    expect(normalizeStoredAssignmentForRole('secretario')).toEqual({
      position: 'secretario',
      label: 'Secretario',
    });
  });
});

describe('parsePermissions', () => {
  it('trata permisos null como campo opcional ausente', () => {
    expect(parsePermissions(null)).toBeUndefined();
  });

  it('acepta los permisos que envia el formulario de supervisores', () => {
    expect(() =>
      parsePermissions({
        usuarios: { view: true, create: true },
        departments: { view: true, manage: true },
        predicacion: {
          view: true,
          manageTerritories: true,
          territories: {
            view: true,
            assign: true,
            manage: true,
          },
        },
      })
    ).not.toThrow();
  });

  it('rechaza departamentos y acciones desconocidas', () => {
    expect(() => parsePermissions({ desconocido: { view: true } })).toThrow(HttpsError);
    expect(() => parsePermissions({ usuarios: { publish: true } })).toThrow(HttpsError);
    expect(() => parsePermissions({ predicacion: { territories: { publish: true } } })).toThrow(HttpsError);
  });

  it('tolera permisos legados al leer perfiles existentes', () => {
    expect(() =>
      parsePermissions(
        {
          usuarios: { view: true, publish: true },
          moduloViejo: { manage: true },
          predicacion: { manageTerritories: 'yes' },
        },
        { strict: false }
      )
    ).not.toThrow();
  });
});

describe('parseServiceAssignments security', () => {
  it('rejects duplicate assignments instead of silently deduplicating', () => {
    expect(() => parseStoredServiceAssignments([
      {position: 'encargado', department: 'limpieza', label: 'ignored'},
      {position: 'encargado', department: 'limpieza', label: 'different'},
    ], 'admin')).toThrow(HttpsError);
  });

  it('rejects more than 20 assignments instead of truncating', () => {
    const assignments = Array.from({length: 21}, (_, index) => ({
      position: 'auxiliar', department: index % 2 ? 'limpieza' : 'reuniones', label: `Label ${index}`,
    }));
    expect(() => parseStoredServiceAssignments(assignments, 'admin')).toThrow(HttpsError);
  });

  it('derives the label from position and department, not client input', () => {
    expect(parseStoredServiceAssignments([
      {position: 'encargado', department: 'limpieza', label: 'Coordinador'},
    ], 'admin')).toEqual([
      {position: 'encargado', department: 'limpieza', label: 'Encargado de Limpieza'},
    ]);
  });
});

describe('backend permission contract', () => {
  it('accepts acomodadores_microfonos and rejects unknown modules', () => {
    expect(parseStoredPermissions({acomodadores_microfonos: {view: true, manage: true}}))
      .toEqual({acomodadores_microfonos: {view: true, manage: true}});
    expect(() => parseStoredPermissions({desconocido: {view: true}})).toThrow(HttpsError);
  });
});

describe('stripOrgChartManageUnlessAuthorized', () => {
  it('strips organigrama/departments manage from non coordinator supervisor and keeps other permissions', () => {
    const permissions = {
      organigrama: { manage: true, view: true },
      departments: { manage: true },
      limpieza: { manage: true },
    };

    expect(stripOrgChartManageUnlessAuthorized(permissions, [], {})).toEqual({
      organigrama: { view: true },
      limpieza: { manage: true },
    });
  });

  it('keeps org chart manage for coordinator assignments', () => {
    const permissions = { organigrama: { manage: true } };

    expect(
      stripOrgChartManageUnlessAuthorized(
        permissions,
        [{ position: 'coordinador' }],
        {}
      )
    ).toEqual({ organigrama: { manage: true } });
  });

  it('keeps org chart manage for system admins', () => {
    const permissions = { departments: { manage: true } };

    expect(
      stripOrgChartManageUnlessAuthorized(
        permissions,
        [],
        { isPrimaryAdmin: true }
      )
    ).toEqual({ departments: { manage: true } });
  });
});

describe('parseCreateUserPayload', () => {
  const valid = {
    firstName: 'Juan',
    lastName: 'Pérez',
    role: 'user',
    congregationId: 'cong_A',
    password: 'segura123',
  };

  it('parsea un payload válido correctamente', () => {
    const result = parseCreateUserPayload(valid);
    expect(result.firstName).toBe('Juan');
    expect(result.role).toBe('user');
    expect(result.isActive).toBe(true); // default
  });

  it('acepta genero cuando se pasa desde clientes actuales', () => {
    const result = parseCreateUserPayload({ ...valid, gender: 'masculino' });
    expect(result.gender).toBe('masculino');
  });

  it('mantiene compatibilidad con clientes antiguos sin genero', () => {
    const result = parseCreateUserPayload(valid);
    expect(result.gender).toBeUndefined();
  });

  it('respeta isActive:false cuando se pasa explícitamente', () => {
    const result = parseCreateUserPayload({ ...valid, isActive: false });
    expect(result.isActive).toBe(false);
  });

  it('lanza error si falta firstName', () => {
    expect(() => parseCreateUserPayload({ ...valid, firstName: '' })).toThrow(
      /primer nombre/
    );
  });

  it('lanza error si falta congregationId', () => {
    expect(() =>
      parseCreateUserPayload({ ...valid, congregationId: undefined })
    ).toThrow(HttpsError);
  });

  it('lanza error si la contraseña tiene menos de 6 caracteres', () => {
    expect(() => parseCreateUserPayload({ ...valid, password: '1234' })).toThrow(HttpsError);
  });

  it('lanza error si el rol es inválido', () => {
    expect(() => parseCreateUserPayload({ ...valid, role: 'superadmin' })).toThrow(HttpsError);
  });

  it('lanza error si el payload no es un objeto', () => {
    expect(() => parseCreateUserPayload('string')).toThrow(HttpsError);
    expect(() => parseCreateUserPayload(null)).toThrow(HttpsError);
    expect(() => parseCreateUserPayload(42)).toThrow(HttpsError);
  });
});

// ─── Tests: normalizeText ─────────────────────────────────────────────────────

describe('normalizeText', () => {
  it('elimina espacios y devuelve la cadena', () => {
    expect(normalizeText('  hola  ')).toBe('hola');
  });

  it('devuelve undefined para cadena vacía tras trim', () => {
    expect(normalizeText('   ')).toBeUndefined();
    expect(normalizeText('')).toBeUndefined();
  });

  it('devuelve undefined para tipos no-string', () => {
    expect(normalizeText(null)).toBeUndefined();
    expect(normalizeText(undefined)).toBeUndefined();
    expect(normalizeText(123)).toBeUndefined();
    expect(normalizeText({})).toBeUndefined();
  });
});
