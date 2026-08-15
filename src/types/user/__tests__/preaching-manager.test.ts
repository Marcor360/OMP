/**
 * P0 — el auxiliar de predicacion/territorios ya no obtiene nivel Manager sin
 * exigirsele isElder (antes tenia el mismo acceso que el encargado, incluida la
 * lista de informes de servicio de toda la congregacion). Pasa a nivel Editor.
 * Espejo de rules_src/03-roles-and-managers.rules (isPreachingManager /
 * isPreachingEditor).
 */
import { isPreachingEditor, isPreachingManager } from '@/src/types/user';

describe('isPreachingManager', () => {
  it('permite al encargado de predicacion con isElder', () => {
    expect(
      isPreachingManager({
        servicePosition: 'encargado',
        serviceDepartment: 'predicacion',
        privileges: { isElder: true },
      })
    ).toBe(true);
  });

  it('permite al encargado de territorios con isElder', () => {
    expect(
      isPreachingManager({
        servicePosition: 'encargado',
        serviceDepartment: 'territorios',
        privileges: { isElder: true },
      })
    ).toBe(true);
  });

  it('bloquea al encargado sin isElder', () => {
    expect(
      isPreachingManager({
        servicePosition: 'encargado',
        serviceDepartment: 'predicacion',
        privileges: { isElder: false },
      })
    ).toBe(false);
  });

  it('bloquea al auxiliar aunque no tenga isElder (P0: ya no es Manager)', () => {
    expect(
      isPreachingManager({
        servicePosition: 'auxiliar',
        serviceDepartment: 'predicacion',
        privileges: {},
      })
    ).toBe(false);
  });

  it('bloquea al auxiliar de territorios via serviceAssignments', () => {
    expect(
      isPreachingManager({
        serviceAssignments: [{ position: 'auxiliar', department: 'territorios', label: 'Auxiliar de territorios' }],
      })
    ).toBe(false);
  });

  it('permite al encargado con isElder via serviceAssignments', () => {
    expect(
      isPreachingManager({
        privileges: { isElder: true },
        serviceAssignments: [{ position: 'encargado', department: 'territorios', label: 'Encargado de territorios' }],
      })
    ).toBe(true);
  });

  it('bloquea a un usuario sin cargo de predicacion/territorios', () => {
    expect(isPreachingManager({ servicePosition: 'encargado', serviceDepartment: 'limpieza' })).toBe(false);
  });

  it('maneja null/undefined sin lanzar', () => {
    expect(isPreachingManager(null)).toBe(false);
    expect(isPreachingManager(undefined)).toBe(false);
  });
});

describe('isPreachingEditor', () => {
  it('es true para todo lo que ya es Manager (superconjunto)', () => {
    const manager = {
      servicePosition: 'encargado' as const,
      serviceDepartment: 'predicacion' as const,
      privileges: { isElder: true },
    };
    expect(isPreachingManager(manager)).toBe(true);
    expect(isPreachingEditor(manager)).toBe(true);
  });

  it('es true para el auxiliar de predicacion (via servicePosition)', () => {
    expect(
      isPreachingEditor({
        servicePosition: 'auxiliar',
        serviceDepartment: 'predicacion',
      })
    ).toBe(true);
  });

  it('es true para el auxiliar de territorios (via serviceAssignments)', () => {
    expect(
      isPreachingEditor({
        serviceAssignments: [{ position: 'auxiliar', department: 'territorios', label: 'Auxiliar de territorios' }],
      })
    ).toBe(true);
  });

  it('sigue bloqueando a quien no tiene ningun cargo en el departamento', () => {
    expect(isPreachingEditor({ servicePosition: 'auxiliar', serviceDepartment: 'limpieza' })).toBe(false);
  });

  it('el auxiliar es Editor pero nunca Manager (la frontera del contrato)', () => {
    const auxiliar = {
      servicePosition: 'auxiliar' as const,
      serviceDepartment: 'predicacion' as const,
    };
    expect(isPreachingEditor(auxiliar)).toBe(true);
    expect(isPreachingManager(auxiliar)).toBe(false);
  });

  it('maneja null/undefined sin lanzar', () => {
    expect(isPreachingEditor(null)).toBe(false);
    expect(isPreachingEditor(undefined)).toBe(false);
  });
});
