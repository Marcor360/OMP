import {
  canManageBilling,
  canOperateBilling,
  canViewBilling,
  hasServiceAssignment,
  type BillingAccessDeps,
  type BillingUser,
} from '../shared/billing-access.js';

const deps = (permissions: Partial<Record<'view' | 'create' | 'manage', boolean>> = {}): BillingAccessDeps => ({
  hasPagosPermission: (action) => permissions[action] === true,
});

describe('billing-access shared rules', () => {
  it.each(['coordinador', 'secretario'] as const)(
    '%s can operate and view billing',
    (position) => {
      const user: BillingUser = { servicePosition: position };

      expect(canOperateBilling(user, deps())).toBe(true);
      expect(canViewBilling(user, deps())).toBe(true);
    }
  );

  it('treasury manager can operate and view billing', () => {
    const user: BillingUser = {
      servicePosition: 'encargado',
      serviceDepartment: 'tesoreria',
    };

    expect(canOperateBilling(user, deps())).toBe(true);
    expect(canViewBilling(user, deps())).toBe(true);
  });

  it('assistant treasury can view but cannot operate without pagos permission', () => {
    const user: BillingUser = {
      servicePosition: 'auxiliar',
      serviceDepartment: 'tesoreria',
    };

    expect(canOperateBilling(user, deps())).toBe(false);
    expect(canViewBilling(user, deps())).toBe(true);
  });

  it('assistant treasury with pagos.create can operate', () => {
    const user: BillingUser = {
      servicePosition: 'auxiliar',
      serviceDepartment: 'tesoreria',
    };

    expect(canOperateBilling(user, deps({ create: true }))).toBe(true);
  });

  it('user without position and pagos.manage can operate, view, and manage billing', () => {
    const user: BillingUser = { role: 'user' };
    const access = deps({ manage: true });

    expect(canOperateBilling(user, access)).toBe(true);
    expect(canViewBilling(user, access)).toBe(true);
    expect(canManageBilling(access)).toBe(true);
  });

  it('approved option A: user with pagos.create can view billing without pagos.view', () => {
    const user: BillingUser = { role: 'user' };

    expect(canViewBilling(user, deps({ create: true }))).toBe(true);
  });

  it('user without role, assignment, or pagos permissions cannot access billing', () => {
    const user: BillingUser = { role: 'user' };
    const access = deps();

    expect(canOperateBilling(user, access)).toBe(false);
    expect(canViewBilling(user, access)).toBe(false);
    expect(canManageBilling(access)).toBe(false);
  });

  it('admin can view billing', () => {
    expect(canViewBilling({ role: 'admin' }, deps())).toBe(true);
  });

  it('detects assignments from serviceAssignments as well as servicePosition', () => {
    const user: BillingUser = {
      serviceAssignments: [{ position: 'encargado', department: 'tesoreria' }],
    };

    expect(hasServiceAssignment(user, 'encargado', 'tesoreria')).toBe(true);
    expect(canOperateBilling(user, deps())).toBe(true);
  });

  it('recognizes apoyo in BillingServicePosition type without granting billing access', () => {
    const user: BillingUser = {
      servicePosition: 'apoyo',
      serviceDepartment: 'tesoreria',
    };

    expect(hasServiceAssignment(user, 'apoyo', 'tesoreria')).toBe(true);
    expect(canOperateBilling(user, deps())).toBe(false);
  });
});
