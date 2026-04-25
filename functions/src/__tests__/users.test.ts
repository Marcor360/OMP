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

// Simula parseCreateUserPayload con validaciones relevantes
function parseCreateUserPayload(raw: unknown): {
  firstName: string;
  lastName: string;
  role: Role;
  congregationId: string;
  password: string;
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

  if (!firstName || !lastName || !displayName || !congregationId || !password) {
    throw new HttpsError('invalid-argument', 'Faltan datos requeridos para crear usuario.');
  }

  assertValidRole(data.role);

  if (password.length < 6) {
    throw new HttpsError('invalid-argument', 'La contrasena debe tener al menos 6 caracteres.');
  }

  return {
    firstName,
    lastName,
    role: data.role,
    congregationId,
    password,
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

  it('respeta isActive:false cuando se pasa explícitamente', () => {
    const result = parseCreateUserPayload({ ...valid, isActive: false });
    expect(result.isActive).toBe(false);
  });

  it('lanza error si falta firstName', () => {
    expect(() => parseCreateUserPayload({ ...valid, firstName: '' })).toThrow(HttpsError);
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
