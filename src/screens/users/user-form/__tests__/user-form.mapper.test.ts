import {
  assignmentKey,
  buildDepartmentLabel,
  buildGeneratedEmailPreview,
  ensureAdminElderPrivileges,
  normalizeNameForEmail,
  parseLegacyAssignment,
  requiresAdminElderAssignment,
  resolveServiceAssignmentFromUser,
  toCreatePayload,
  toPayload,
  toUpdatePayload,
} from '../user-form.mapper';
import type { AppUser, UserServiceAssignment } from '@/src/types/user';

describe('user-form.mapper', () => {
  it('normalizes generated email previews like the original form', () => {
    expect(normalizeNameForEmail(' Án-gel 42 ')).toBe('angel42');
    expect(buildGeneratedEmailPreview('Juan', 'Carlos', 'Perez', 'Congregacion.COM')).toBe(
      'juanperez@congregacion.com'
    );
    expect(buildGeneratedEmailPreview('', '', '', 'Congregacion.COM')).toBe(
      'usuario@congregacion.com'
    );
  });

  it('maps legacy assignment labels to service assignments', () => {
    expect(parseLegacyAssignment('Coordinador')).toEqual({
      position: 'coordinador',
      department: '',
    });
    expect(parseLegacyAssignment('Encargado de Limpieza')).toEqual({
      position: 'encargado',
      department: 'limpieza',
    });
    expect(buildDepartmentLabel('auxiliar', 'predicacion')).toBe('Auxiliar de Predicacion');
  });

  it('resolves service assignments from modern or legacy user fields', () => {
    const direct: UserServiceAssignment[] = [
      { position: 'secretario', label: 'Secretario' },
    ];
    expect(
      resolveServiceAssignmentFromUser({
        serviceAssignments: direct,
        servicePosition: undefined,
        serviceDepartment: undefined,
        department: undefined,
      })
    ).toBe(direct);

    expect(
      resolveServiceAssignmentFromUser({
        servicePosition: 'encargado',
        serviceDepartment: 'limpieza',
        department: undefined,
        serviceAssignments: [],
      })
    ).toEqual([
      {
        position: 'encargado',
        department: 'limpieza',
        label: 'Encargado de Limpieza',
      },
    ]);
  });

  it('keeps admin elder escalation rules for coordinator/secretary assignments', () => {
    const assignments: UserServiceAssignment[] = [
      { position: 'coordinador', label: 'Coordinador' },
    ];

    expect(assignmentKey(assignments[0])).toBe('coordinador:');
    expect(requiresAdminElderAssignment(assignments)).toBe(true);
    expect(ensureAdminElderPrivileges(assignments, { isMinisterialServant: true })).toEqual({
      isElder: true,
      isMinisterialServant: false,
    });
  });

  it('builds create and update payloads with the original shape', () => {
    const serviceAssignments: UserServiceAssignment[] = [
      { position: 'auxiliar', department: 'predicacion', label: 'Auxiliar de Predicacion' },
    ];
    const base = {
      mode: 'create' as const,
      isAdmin: true,
      displayName: 'Juan Perez',
      firstName: ' Juan ',
      middleName: '',
      lastName: ' Perez ',
      secondLastName: '',
      password: ' secret ',
      email: 'juanperez@example.com',
      role: 'supervisor' as AppUser['role'],
      congregationId: 'c1',
      gender: 'masculino' as const,
      phone: ' 555 ',
      serviceAssignments,
      privileges: { isAuxiliaryPioneer: true },
      responsibilities: {},
      permissions: { predicacion: { view: true } },
    };

    expect(toCreatePayload(base)).toMatchObject({
      firstName: 'Juan',
      lastName: 'Perez',
      password: 'secret',
      displayName: 'Juan Perez',
      email: 'juanperez@example.com',
      department: 'Auxiliar de Predicacion',
      servicePosition: 'auxiliar',
      serviceDepartment: 'predicacion',
      permissions: { predicacion: { view: true } },
      isActive: true,
    });

    expect(toUpdatePayload({ ...base, mode: 'edit' })).toMatchObject({
      displayName: 'Juan Perez',
      role: 'supervisor',
      phone: '555',
      department: 'Auxiliar de Predicacion',
    });

    expect(toUpdatePayload({ ...base, mode: 'edit', isAdmin: false })).toEqual({
      displayName: 'Juan Perez',
      gender: 'masculino',
      phone: '555',
    });

    expect(toPayload(base)).toMatchObject({
      firstName: 'Juan',
      email: 'juanperez@example.com',
    });
  });
});
