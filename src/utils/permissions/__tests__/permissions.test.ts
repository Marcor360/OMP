import {
  canManageCleaning,
  canManageMeetings,
  canManageUsers,
  getDefaultPermissionsByRole,
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
});
