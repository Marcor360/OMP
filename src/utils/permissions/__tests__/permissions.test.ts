import {
  SUPERVISOR_PERMISSION_TEMPLATE,
  canManageDepartments,
  canManageCleaning,
  canManageMeetings,
  canManageUsers,
  canViewOrgChart,
  getDefaultPermissionsByRole,
  getEffectivePermissions,
  hasPermission,
  hasRole,
} from '@/src/utils/permissions/permissions';

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
});
