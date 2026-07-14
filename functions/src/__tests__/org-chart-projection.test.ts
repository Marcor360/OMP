import { computeDesiredAssignments } from '../organization/org-chart-projection.js';
import type { ServicePosition, StoredServiceAssignment } from '../users/types.js';

const user = (
  uid: string,
  displayName: string,
  assignments: { position: ServicePosition; department?: StoredServiceAssignment['department']; label: string }[]
) => ({
  uid,
  displayName,
  serviceAssignments: assignments as StoredServiceAssignment[],
});

describe('computeDesiredAssignments', () => {
  it('coloca al coordinador como raiz sin padre', () => {
    const { assignments, warnings } = computeDesiredAssignments([
      user('u1', 'Ana Coordinadora', [{ position: 'coordinador', label: 'Coordinador' }]),
    ]);

    const coordinator = assignments.find((item) => item.position === 'coordinador');
    expect(coordinator?.parentAssignmentId).toBeNull();
    expect(coordinator?.departmentId).toBe('coordinacion');
    expect(warnings).not.toContain('Ningun usuario tiene el puesto de Coordinador.');
  });

  it('cuelga al secretario del coordinador', () => {
    const { assignments } = computeDesiredAssignments([
      user('u1', 'Ana Coordinadora', [{ position: 'coordinador', label: 'Coordinador' }]),
      user('u2', 'Beto Secretario', [{ position: 'secretario', label: 'Secretario' }]),
    ]);

    const coordinatorId = assignments.find((item) => item.position === 'coordinador')?.id;
    const secretary = assignments.find((item) => item.position === 'secretario');
    expect(secretary?.parentAssignmentId).toBe(coordinatorId);
  });

  it('cuelga al auxiliar del encargado del mismo departamento', () => {
    const { assignments } = computeDesiredAssignments([
      user('u1', 'Carla Encargada', [
        { position: 'encargado', department: 'limpieza', label: 'Encargado de Limpieza' },
      ]),
      user('u2', 'Dario Auxiliar', [
        { position: 'auxiliar', department: 'limpieza', label: 'Auxiliar de Limpieza' },
      ]),
    ]);

    const manager = assignments.find((item) => item.position === 'encargado');
    const assistant = assignments.find((item) => item.position === 'auxiliar');
    expect(assistant?.parentAssignmentId).toBe(manager?.id);
  });

  it('omite un encargado sin departamento y agrega advertencia', () => {
    const { assignments, warnings } = computeDesiredAssignments([
      user('u1', 'Elena Sin Depto', [{ position: 'encargado', label: 'Encargado' }]),
    ]);

    expect(assignments).toHaveLength(0);
    expect(warnings.some((warning) => warning.includes('sin departamento'))).toBe(true);
  });

  it('rechaza dos coordinadores activos', () => {
    expect(() => computeDesiredAssignments([
      user('u2', 'Zoe Coordinadora', [{ position: 'coordinador', label: 'Coordinador' }]),
      user('u1', 'Ana Coordinadora', [{ position: 'coordinador', label: 'Coordinador' }]),
    ])).toThrow('Hay mas de un coordinador activo');
  });

  it('rechaza dos secretarios activos', () => {
    expect(() => computeDesiredAssignments([
      user('u1', 'Ana', [{position: 'secretario', label: 'Secretario'}]),
      user('u2', 'Beto', [{position: 'secretario', label: 'Secretario'}]),
    ])).toThrow('Hay mas de un secretario activo');
  });

  it('advierte cuando no hay coordinador', () => {
    const { warnings } = computeDesiredAssignments([
      user('u1', 'Beto Secretario', [{ position: 'secretario', label: 'Secretario' }]),
    ]);

    expect(warnings).toContain('Ningun usuario tiene el puesto de Coordinador.');
  });
});
