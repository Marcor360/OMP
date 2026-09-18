import { requesterHasPermission } from '../users/authorization.js';
import type { RequesterProfile } from '../users/types.js';

const profile = (overrides: Partial<RequesterProfile>): RequesterProfile => ({
  role: 'supervisor', isActive: true, congregationId: 'cong-a', ...overrides,
});

describe('effective requester permissions', () => {
  it('denies missing manual and derived permissions', () => {
    expect(requesterHasPermission(profile({}), 'limpieza', 'edit')).toBe(false);
  });

  it('allows manual or derived permissions and expands manage to subordinate actions', () => {
    expect(requesterHasPermission(profile({ permissions: { limpieza: { edit: true } } }), 'limpieza', 'edit')).toBe(true);
    expect(requesterHasPermission(profile({ derivedPermissions: { limpieza: { edit: true } } }), 'limpieza', 'edit')).toBe(true);
    expect(requesterHasPermission(profile({ derivedPermissions: { limpieza: { manage: true } } }), 'limpieza', 'delete')).toBe(true);
  });

  it('does not grant another department and preserves the admin exception', () => {
    expect(requesterHasPermission(profile({ derivedPermissions: { reuniones: { manage: true } } }), 'limpieza', 'edit')).toBe(false);
    expect(requesterHasPermission(profile({ role: 'admin' }), 'usuarios', 'delete')).toBe(true);
  });
});
