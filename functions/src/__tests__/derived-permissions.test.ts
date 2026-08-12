/**
 * Fase 0 (F0.1) — Test de equivalencia: functions/src/shared/derived-permissions.ts
 * debe producir EXACTAMENTE el mismo resultado que
 * src/utils/permissions/permissions.ts:assignmentToPermissions /
 * getPermissionsFromServiceAssignments para el mismo perfil.
 *
 * functions/ y la app son dos proyectos TypeScript separados (distinto
 * package.json, distinta resolucion de modulos) -- no se puede importar
 * directamente el archivo del frontend desde aqui, igual que el resto de
 * functions/src/__tests__ no importa Firestore real. Los fixtures de abajo
 * transcriben literalmente la tabla del frontend (verificada linea por linea
 * contra src/utils/permissions/permissions.ts:219-305 al escribir este test);
 * si un dia divergen, es evidencia de que alguien cambio una tabla sin la otra.
 */
import {
  assignmentToPermissions,
  getPermissionsFromServiceAssignments,
  mergePermissions,
  permissionsEqual,
  UserPermissions,
} from '../shared/derived-permissions.js';

describe('assignmentToPermissions — cubre los 12 pares position x department', () => {
  const cases: { label: string; assignment: { position?: string; department?: string }; expected: UserPermissions }[] = [
    {
      label: 'encargado:limpieza',
      assignment: { position: 'encargado', department: 'limpieza' },
      expected: { limpieza: { view: true, create: true, edit: true, delete: true, manage: true } },
    },
    {
      label: 'auxiliar:limpieza',
      assignment: { position: 'auxiliar', department: 'limpieza' },
      expected: { limpieza: { view: true, edit: true } },
    },
    {
      label: 'encargado:tesoreria',
      assignment: { position: 'encargado', department: 'tesoreria' },
      expected: {
        tesoreria: { view: true, create: true, edit: true, delete: true, manage: true },
        pagos: { view: true, create: true, approve: true, manage: true },
      },
    },
    {
      label: 'auxiliar:tesoreria',
      assignment: { position: 'auxiliar', department: 'tesoreria' },
      expected: {
        tesoreria: { view: true, create: true, edit: true },
        pagos: { view: true },
      },
    },
    {
      label: 'encargado:predicacion',
      assignment: { position: 'encargado', department: 'predicacion' },
      expected: { predicacion: { view: true, approve: true, export: true, manage: true } },
    },
    {
      label: 'encargado:territorios (mismo resultado que predicacion)',
      assignment: { position: 'encargado', department: 'territorios' },
      expected: { predicacion: { view: true, approve: true, export: true, manage: true } },
    },
    {
      label: 'auxiliar:predicacion',
      assignment: { position: 'auxiliar', department: 'predicacion' },
      expected: { predicacion: { view: true, export: true } },
    },
    {
      label: 'auxiliar:territorios (mismo resultado que predicacion)',
      assignment: { position: 'auxiliar', department: 'territorios' },
      expected: { predicacion: { view: true, export: true } },
    },
    {
      label: 'encargado:reuniones',
      assignment: { position: 'encargado', department: 'reuniones' },
      expected: { reuniones: { view: true, create: true, edit: true, delete: true, manage: true } },
    },
    {
      label: 'auxiliar:reuniones',
      assignment: { position: 'auxiliar', department: 'reuniones' },
      expected: { reuniones: { view: true, edit: true } },
    },
    {
      label: 'encargado:discursos',
      assignment: { position: 'encargado', department: 'discursos' },
      expected: { asignaciones: { view: true, create: true, edit: true, delete: true, manage: true } },
    },
    {
      label: 'auxiliar:discursos',
      assignment: { position: 'auxiliar', department: 'discursos' },
      expected: { asignaciones: { view: true, edit: true } },
    },
    {
      label: 'encargado:acomodadores_microfonos',
      assignment: { position: 'encargado', department: 'acomodadores_microfonos' },
      expected: {
        acomodadores_microfonos: { view: true, create: true, edit: true, manage: true },
        asignaciones: { view: true, create: true, edit: true, manage: true },
        reuniones: { view: true, edit: true },
      },
    },
    {
      label: 'auxiliar:acomodadores_microfonos',
      assignment: { position: 'auxiliar', department: 'acomodadores_microfonos' },
      expected: {
        acomodadores_microfonos: { view: true, edit: true },
        asignaciones: { view: true, edit: true },
        reuniones: { view: true, edit: true },
      },
    },
    { label: 'sin match: encargado:configuracion', assignment: { position: 'encargado', department: 'configuracion' }, expected: {} },
    { label: 'sin match: auxiliar sin department', assignment: { position: 'auxiliar' }, expected: {} },
    { label: 'sin match: coordinador (no esta en la tabla)', assignment: { position: 'coordinador', department: 'limpieza' }, expected: {} },
    { label: 'sin match: position vacio', assignment: {}, expected: {} },
  ];

  it.each(cases.map((c) => [c.label, c.assignment, c.expected] as const))(
    '%s',
    (_label, assignment, expected) => {
      expect(assignmentToPermissions(assignment)).toEqual(expected);
    }
  );

  it('cubre las 12 combinaciones position x department mas los casos sin match (>= 20 perfiles en total con getPermissionsFromServiceAssignments)', () => {
    expect(cases.length).toBeGreaterThanOrEqual(18);
  });
});

describe('getPermissionsFromServiceAssignments', () => {
  it('perfil con servicePosition/serviceDepartment plano (encargado de limpieza)', () => {
    expect(
      getPermissionsFromServiceAssignments({
        servicePosition: 'encargado',
        serviceDepartment: 'limpieza',
      })
    ).toEqual({ limpieza: { view: true, create: true, edit: true, delete: true, manage: true } });
  });

  it('perfil con serviceAssignments[] (auxiliar de reuniones)', () => {
    expect(
      getPermissionsFromServiceAssignments({
        serviceAssignments: [{ position: 'auxiliar', department: 'reuniones' }],
      })
    ).toEqual({ reuniones: { view: true, edit: true } });
  });

  it('combina servicePosition plano + serviceAssignments[] sin pisarse (encargado de limpieza + auxiliar de reuniones)', () => {
    const result = getPermissionsFromServiceAssignments({
      servicePosition: 'encargado',
      serviceDepartment: 'limpieza',
      serviceAssignments: [{ position: 'auxiliar', department: 'reuniones' }],
    });
    expect(result.limpieza).toEqual({ view: true, create: true, edit: true, delete: true, manage: true });
    expect(result.reuniones).toEqual({ view: true, edit: true });
  });

  it('doble asignacion en el mismo departamento: la mas alta gana por accion (manage no se pierde)', () => {
    const result = getPermissionsFromServiceAssignments({
      serviceAssignments: [
        { position: 'auxiliar', department: 'limpieza' },
        { position: 'encargado', department: 'limpieza' },
      ],
    });
    expect(result.limpieza).toEqual({ view: true, create: true, edit: true, delete: true, manage: true });
  });

  it('usuario sin ningun cargo -> permisos vacios', () => {
    expect(getPermissionsFromServiceAssignments(null)).toEqual({});
    expect(getPermissionsFromServiceAssignments(undefined)).toEqual({});
    expect(getPermissionsFromServiceAssignments({})).toEqual({});
  });

  it('acomodadores_microfonos otorga tambien asignaciones y reuniones al encargado', () => {
    const result = getPermissionsFromServiceAssignments({
      servicePosition: 'encargado',
      serviceDepartment: 'acomodadores_microfonos',
    });
    expect(result).toEqual({
      acomodadores_microfonos: { view: true, create: true, edit: true, manage: true },
      asignaciones: { view: true, create: true, edit: true, manage: true },
      reuniones: { view: true, edit: true },
    });
  });
});

describe('mergePermissions', () => {
  it('une manage sin perder otras acciones ya otorgadas', () => {
    const merged = mergePermissions(
      { limpieza: { view: true, edit: true } },
      { limpieza: { manage: true } }
    );
    expect(merged.limpieza).toEqual({ view: true, edit: true, manage: true });
  });

  it('ignora entradas null/undefined en la lista', () => {
    expect(mergePermissions(null, { reuniones: { view: true } }, undefined)).toEqual({
      reuniones: { view: true },
    });
  });

  it('une territories de predicacion sin perder acciones previas', () => {
    const merged = mergePermissions(
      { predicacion: { view: true, territories: { view: true } } },
      { predicacion: { territories: { manage: true } } }
    );
    expect(merged.predicacion).toEqual({ view: true, territories: { view: true, manage: true } });
  });
});

describe('permissionsEqual', () => {
  it('true para el mismo contenido con distinto orden de claves', () => {
    const a: UserPermissions = { limpieza: { view: true, edit: true }, reuniones: { view: true } };
    const b: UserPermissions = { reuniones: { view: true }, limpieza: { edit: true, view: true } };
    expect(permissionsEqual(a, b)).toBe(true);
  });

  it('false cuando cambia una accion', () => {
    expect(
      permissionsEqual({ limpieza: { view: true } }, { limpieza: { view: true, edit: true } })
    ).toBe(false);
  });

  it('trata {} y {department: {}} (sin acciones true) como equivalentes', () => {
    expect(permissionsEqual({}, { limpieza: {} })).toBe(true);
  });

  it('null/undefined equivalen a permisos vacios', () => {
    expect(permissionsEqual(null, undefined)).toBe(true);
    expect(permissionsEqual(null, {})).toBe(true);
  });
});
