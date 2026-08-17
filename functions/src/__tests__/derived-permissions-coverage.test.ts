/**
 * PR B (Fase 0) — cobertura completa de la rejilla 13 departamentos x 2
 * posiciones (26 pares) para assignmentToPermissions(), incluyendo los pares
 * nuevos de este PR (asignaciones, hospitalidad) y los que quedan
 * deliberadamente sin permisos (literatura, mantenimiento, audio_video,
 * usuarios, configuracion).
 *
 * No modifica derived-permissions.test.ts (los 12 pares que ya cubria ese
 * archivo siguen intactos alli). Fixtures verificados linea por linea contra
 * src/utils/permissions/permissions.ts:assignmentToPermissions al escribir
 * este test -- si un dia divergen, es evidencia de que alguien cambio una
 * tabla sin la otra.
 */
import {
  assignmentToPermissions,
  SERVICE_DEPARTMENT_PERMISSION_DECISIONS,
  UserPermissions,
} from '../shared/derived-permissions.js';

const FULL_ASIGNACIONES = { view: true, create: true, edit: true, delete: true, manage: true };
const LIMITED_ASIGNACIONES = { view: true, edit: true };

const HOSPITALITY_ENCARGADO: UserPermissions = {
  acomodadores_microfonos: { view: true, create: true, edit: true, manage: true },
  asignaciones: { view: true, create: true, edit: true, manage: true },
  reuniones: { view: true, edit: true },
};

const HOSPITALITY_AUXILIAR: UserPermissions = {
  acomodadores_microfonos: { view: true, edit: true },
  asignaciones: { view: true, edit: true },
  reuniones: { view: true, edit: true },
};

const GRID: { department: string; encargado: UserPermissions; auxiliar: UserPermissions }[] = [
  {
    department: 'limpieza',
    encargado: { limpieza: { view: true, create: true, edit: true, delete: true, manage: true } },
    auxiliar: { limpieza: { view: true, edit: true } },
  },
  { department: 'literatura', encargado: {}, auxiliar: {} },
  {
    department: 'tesoreria',
    encargado: {
      tesoreria: { view: true, create: true, edit: true, delete: true, manage: true },
      pagos: { view: true, create: true, approve: true, manage: true },
    },
    auxiliar: { tesoreria: { view: true, create: true, edit: true }, pagos: { view: true } },
  },
  { department: 'mantenimiento', encargado: {}, auxiliar: {} },
  {
    department: 'discursos',
    encargado: { asignaciones: FULL_ASIGNACIONES },
    auxiliar: { asignaciones: LIMITED_ASIGNACIONES },
  },
  {
    department: 'reuniones',
    encargado: { reuniones: { view: true, create: true, edit: true, delete: true, manage: true } },
    auxiliar: { reuniones: { view: true, edit: true } },
  },
  {
    department: 'predicacion',
    encargado: { predicacion: { view: true, approve: true, export: true, manage: true } },
    auxiliar: { predicacion: { view: true, export: true } },
  },
  {
    department: 'asignaciones',
    encargado: { asignaciones: FULL_ASIGNACIONES },
    auxiliar: { asignaciones: LIMITED_ASIGNACIONES },
  },
  { department: 'hospitalidad', encargado: HOSPITALITY_ENCARGADO, auxiliar: HOSPITALITY_AUXILIAR },
  { department: 'usuarios', encargado: {}, auxiliar: {} },
  { department: 'configuracion', encargado: {}, auxiliar: {} },
  { department: 'audio_video', encargado: {}, auxiliar: {} },
  {
    department: 'acomodadores_microfonos',
    encargado: HOSPITALITY_ENCARGADO,
    auxiliar: HOSPITALITY_AUXILIAR,
  },
];

describe('assignmentToPermissions — rejilla completa 13 departamentos x 2 posiciones', () => {
  it('cubre exactamente 13 departamentos (26 pares)', () => {
    expect(GRID.length).toBe(13);
  });

  it.each(GRID.map((row) => [row.department, 'encargado', row.encargado] as const))(
    '%s:%s',
    (department, position, expected) => {
      expect(assignmentToPermissions({ position, department })).toEqual(expected);
    }
  );

  it.each(GRID.map((row) => [row.department, 'auxiliar', row.auxiliar] as const))(
    '%s:%s',
    (department, position, expected) => {
      expect(assignmentToPermissions({ position, department })).toEqual(expected);
    }
  );

  it('hospitalidad es un alias exacto de acomodadores_microfonos', () => {
    expect(assignmentToPermissions({ position: 'encargado', department: 'hospitalidad' })).toEqual(
      assignmentToPermissions({ position: 'encargado', department: 'acomodadores_microfonos' })
    );
    expect(assignmentToPermissions({ position: 'auxiliar', department: 'hospitalidad' })).toEqual(
      assignmentToPermissions({ position: 'auxiliar', department: 'acomodadores_microfonos' })
    );
  });

  it('cada fila con permisos vacios en la rejilla coincide con un motivo documentado en SERVICE_DEPARTMENT_PERMISSION_DECISIONS', () => {
    GRID.forEach((row) => {
      const decision = SERVICE_DEPARTMENT_PERMISSION_DECISIONS[row.department as keyof typeof SERVICE_DEPARTMENT_PERMISSION_DECISIONS];
      const isEmpty = Object.keys(row.encargado).length === 0;
      if (isEmpty) {
        expect(decision).not.toBeNull();
      } else {
        expect(decision).toBeNull();
      }
    });
  });
});
