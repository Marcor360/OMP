import {
  canCancelSubscription,
  canPaySubscription,
  canViewBilling,
  hasServiceAssignment,
} from '@/src/utils/users/billing-permissions';
import { hasPermission } from '@/src/utils/permissions/permissions';
import type { AppUser } from '@/src/types/user';

jest.mock('@/src/utils/permissions/permissions', () => ({
  hasPermission: jest.fn(),
}));

const mockedHasPermission = hasPermission as jest.MockedFunction<typeof hasPermission>;

const makeUser = (overrides: Partial<AppUser> = {}): AppUser => ({
  uid: 'user-1',
  email: 'user@example.com',
  displayName: 'User Example',
  role: 'user',
  congregationId: 'cong-1',
  isActive: true,
  status: 'active',
  isElder: false,
  isMinisterialServant: false,
  ...overrides,
});

const mockPagosPermissions = (
  values: Partial<Record<'view' | 'create' | 'manage', boolean>>
): void => {
  mockedHasPermission.mockImplementation((_user, department, action) => {
    if (department !== 'pagos') return false;
    if (action !== 'view' && action !== 'create' && action !== 'manage') return false;
    return values[action] === true;
  });
};

describe('billing-permissions front adapter', () => {
  beforeEach(() => {
    mockedHasPermission.mockReset();
    mockPagosPermissions({});
  });

  it('delegates canViewBilling to shared rules with rich pagos.view resolution', () => {
    const user = makeUser();
    mockPagosPermissions({ view: true });

    expect(canViewBilling(user)).toBe(true);
    expect(mockedHasPermission).toHaveBeenCalledWith(user, 'pagos', 'view');
  });

  it('delegates canPaySubscription to shared canOperate rules', () => {
    const user = makeUser();
    mockPagosPermissions({ create: true });

    expect(canPaySubscription(user)).toBe(true);
    expect(mockedHasPermission).toHaveBeenCalledWith(user, 'pagos', 'create');
  });

  it('delegates canCancelSubscription to shared manage gate', () => {
    const user = makeUser();
    mockPagosPermissions({ manage: true });

    expect(canCancelSubscription(user)).toBe(true);
    expect(mockedHasPermission).toHaveBeenCalledWith(user, 'pagos', 'manage');
  });

  it('approved option A: pagos.create without a position can view billing', () => {
    const user = makeUser();
    mockPagosPermissions({ create: true });

    expect(canViewBilling(user)).toBe(true);
  });

  it('maps servicePosition and serviceAssignments into BillingUser for assignment checks', () => {
    const directUser = makeUser({
      servicePosition: 'encargado',
      serviceDepartment: 'tesoreria',
    });
    const assignedUser = makeUser({
      serviceAssignments: [
        { position: 'auxiliar', department: 'tesoreria', label: 'Auxiliar de Tesoreria' },
      ],
    });

    expect(hasServiceAssignment(directUser, 'encargado', 'tesoreria')).toBe(true);
    expect(hasServiceAssignment(assignedUser, 'auxiliar', 'tesoreria')).toBe(true);
  });
});
