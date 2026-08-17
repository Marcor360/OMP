import {
  SUPERVISOR_PERMISSION_TEMPLATE,
  canEditHospitalityAssignments,
  canManageDepartments,
  canManageCleaning,
  canManageMeetings,
  canManageHospitalityMicrophones,
  canManageUsers,
  canViewOrgChart,
  getDefaultPermissionsByRole,
  getEffectivePermissions,
  getPermissionsFromServiceAssignments,
  hasPermission,
  hasRole,
} from '@/src/utils/permissions/permissions';
import { USER_SERVICE_DEPARTMENTS } from '@/src/types/user';

describe('permissions utilities', () => {
  it('orders technical roles without organizational privilege assumptions', () => {
    expect(hasRole('admin', 'supervisor')).toBe(true);
    expect(hasRole('supervisor', 'admin')).toBe(false);
    expect(hasRole('user', 'user')).toBe(true);
    expect(hasRole(undefined, 'user')).toBe(false);
  });

  it('grants default admin permissions except payments', () => {
    const admin = { role: 'admin' as const };

    expect(hasPermission(admin, 'usuarios', 'delete')).toBe(true);
    expect(hasPermission(admin, 'pagos', 'manage')).toBe(false);
  });

  it('keeps common users limited to safe default visibility/actions', () => {
    const user = { role: 'user' as const };
    const defaults = getDefaultPermissionsByRole('user');

    expect(defaults.reuniones?.view).toBe(true);
    expect(defaults.predicacion?.create).toBe(true);
    expect(canManageUsers(user)).toBe(false);
    expect(canManageMeetings(user)).toBe(false);
  });

  it('gives department managers scoped control for their department', () => {
    const cleaningManager = {
      role: 'user' as const,
      serviceAssignments: [
        {
          position: 'encargado' as const,
          department: 'limpieza' as const,
          label: 'Limpieza',
        },
      ],
    };

    expect(canManageCleaning(cleaningManager)).toBe(true);
    expect(canManageUsers(cleaningManager)).toBe(false);
  });

  it('separates hospitality draft editing from publishing', () => {
    const assistant = {
      role: 'user' as const,
      serviceAssignments: [{
        position: 'auxiliar' as const,
        department: 'acomodadores_microfonos' as const,
        label: 'Auxiliar',
      }],
    };
    const manager = {
      role: 'user' as const,
      serviceAssignments: [{
        position: 'encargado' as const,
        department: 'acomodadores_microfonos' as const,
        label: 'Encargado',
      }],
    };

    expect(canEditHospitalityAssignments(assistant)).toBe(true);
    expect(canManageHospitalityMicrophones(assistant)).toBe(false);
    expect(canEditHospitalityAssignments(manager)).toBe(true);
    expect(canManageHospitalityMicrophones(manager)).toBe(true);
  });

  it('keeps explicit hospitality manage permission additive for assistants', () => {
    const delegatedAssistant = {
      role: 'user' as const,
      permissions: { acomodadores_microfonos: { manage: true } },
      serviceAssignments: [{
        position: 'auxiliar' as const,
        department: 'acomodadores_microfonos' as const,
        label: 'Auxiliar',
      }],
    };

    expect(canEditHospitalityAssignments(delegatedAssistant)).toBe(true);
    expect(canManageHospitalityMicrophones(delegatedAssistant)).toBe(true);
  });

  it('mirrors org chart permissions from organigrama to departments', () => {
    const user = {
      role: 'user' as const,
      permissions: { organigrama: { manage: true } },
    };

    expect(getEffectivePermissions(user).departments?.manage).toBe(true);
    expect(hasPermission(user, 'departments', 'manage')).toBe(true);
  });

  it('mirrors org chart permissions from departments to organigrama', () => {
    const user = {
      role: 'user' as const,
      permissions: { departments: { manage: true } },
    };

    expect(getEffectivePermissions(user).organigrama?.manage).toBe(true);
    expect(hasPermission(user, 'organigrama', 'manage')).toBe(true);
  });

  it('keeps org chart permissions false when neither alias is granted', () => {
    const user = { role: 'user' as const };

    expect(hasPermission(user, 'departments', 'manage')).toBe(false);
    expect(hasPermission(user, 'organigrama', 'manage')).toBe(false);
  });

  it('does not let supervisor org chart manage permissions administer departments', () => {
    expect(
      canManageDepartments({
        role: 'supervisor',
        isActive: true,
        congregationId: 'c1',
        permissions: { organigrama: { manage: true } },
      })
    ).toBe(false);
  });

  it('does not let a common admin administer departments without service assignment or system flags', () => {
    expect(
      canManageDepartments({
        role: 'admin',
        isActive: true,
        congregationId: 'c1',
      })
    ).toBe(false);
  });

  it('lets coordinator, secretary and primary admin administer departments', () => {
    expect(
      canManageDepartments({
        role: 'admin',
        isActive: true,
        congregationId: 'c1',
        serviceAssignments: [{ position: 'coordinador', label: 'Coordinador' }],
      })
    ).toBe(true);
    expect(
      canManageDepartments({
        role: 'admin',
        isActive: true,
        congregationId: 'c1',
        serviceAssignments: [{ position: 'secretario', label: 'Secretario' }],
      })
    ).toBe(true);
    expect(
      canManageDepartments({
        role: 'admin',
        isActive: true,
        congregationId: 'c1',
        isPrimaryAdmin: true,
      })
    ).toBe(true);
  });

  it('keeps coordination permissions out of the supervisor template', () => {
    expect(SUPERVISOR_PERMISSION_TEMPLATE.departments).toBeUndefined();
    expect(SUPERVISOR_PERMISSION_TEMPLATE.organigrama).toBeUndefined();
  });

  it('keeps org chart visible to active congregation users', () => {
    expect(canViewOrgChart({ isActive: true, congregationId: 'c1' })).toBe(true);
  });

  describe('service department permission coverage (PR A)', () => {
    const derive = (position: string, department: string) =>
      getPermissionsFromServiceAssignments({
        servicePosition: position as never,
        serviceDepartment: department as never,
        serviceAssignments: [],
      });

    it('maps encargado:asignaciones to full asignaciones control', () => {
      expect(derive('encargado', 'asignaciones')).toEqual({
        asignaciones: { view: true, create: true, edit: true, delete: true, manage: true },
      });
    });

    it('maps auxiliar:asignaciones to limited asignaciones control', () => {
      expect(derive('auxiliar', 'asignaciones')).toEqual({
        asignaciones: { view: true, edit: true },
      });
    });

    it('treats hospitalidad as an exact alias of acomodadores_microfonos', () => {
      expect(derive('encargado', 'hospitalidad')).toEqual(
        derive('encargado', 'acomodadores_microfonos')
      );
      expect(derive('auxiliar', 'hospitalidad')).toEqual(
        derive('auxiliar', 'acomodadores_microfonos')
      );
    });

    it('derives no permissions for usuarios or configuracion regardless of position', () => {
      expect(derive('encargado', 'usuarios')).toEqual({});
      expect(derive('encargado', 'configuracion')).toEqual({});
    });

    it('derives no permissions for the apoyo position across every service department', () => {
      USER_SERVICE_DEPARTMENTS.forEach((department) => {
        expect(derive('apoyo', department)).toEqual({});
      });
    });

    it('keeps the six previously-mapped departments producing the same permissions as before this PR', () => {
      expect(derive('encargado', 'limpieza')).toEqual({
        limpieza: { view: true, create: true, edit: true, delete: true, manage: true },
      });
      expect(derive('auxiliar', 'limpieza')).toEqual({
        limpieza: { view: true, edit: true },
      });

      expect(derive('encargado', 'tesoreria')).toEqual({
        tesoreria: { view: true, create: true, edit: true, delete: true, manage: true },
        pagos: { view: true, create: true, approve: true, manage: true },
      });
      expect(derive('auxiliar', 'tesoreria')).toEqual({
        tesoreria: { view: true, create: true, edit: true },
        pagos: { view: true },
      });

      expect(derive('encargado', 'predicacion')).toEqual({
        predicacion: { view: true, approve: true, export: true, manage: true },
      });
      expect(derive('auxiliar', 'predicacion')).toEqual({
        predicacion: { view: true, export: true },
      });

      expect(derive('encargado', 'reuniones')).toEqual({
        reuniones: { view: true, create: true, edit: true, delete: true, manage: true },
      });
      expect(derive('auxiliar', 'reuniones')).toEqual({
        reuniones: { view: true, edit: true },
      });

      expect(derive('encargado', 'discursos')).toEqual({
        asignaciones: { view: true, create: true, edit: true, delete: true, manage: true },
      });
      expect(derive('auxiliar', 'discursos')).toEqual({
        asignaciones: { view: true, edit: true },
      });

      expect(derive('encargado', 'acomodadores_microfonos')).toEqual({
        acomodadores_microfonos: { view: true, create: true, edit: true, manage: true },
        asignaciones: { view: true, create: true, edit: true, manage: true },
        reuniones: { view: true, edit: true },
      });
      expect(derive('auxiliar', 'acomodadores_microfonos')).toEqual({
        acomodadores_microfonos: { view: true, edit: true },
        asignaciones: { view: true, edit: true },
        reuniones: { view: true, edit: true },
      });
    });
  });
});
