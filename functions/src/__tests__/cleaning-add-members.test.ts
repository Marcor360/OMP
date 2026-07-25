/**
 * Pruebas unitarias — addCleaningGroupMembersByManager (PR 8)
 *
 * Importa los helpers puros usados realmente por las callables para evitar que
 * las pruebas y la implementacion puedan divergir silenciosamente.
 */

import {
  canManageCleaningFromProfile,
  exceedsCleaningMemberLimit,
  isCleaningGroupDeleteAdmin,
  resolveCleaningMemberOutcome,
  resolveExistingCleaningGroupIndex,
} from '../shared/cleaning-access.js';

// Espejo minimo de la rama "adminRestricted" de assertAdministrativeBillingAccess
// (functions/src/users/authorization.ts): solo el caso directo, sin depender de
// Date.now() ni de graceUntil, que ya tiene cobertura propia en otro lado.
const isDirectlyBillingRestricted = (billing: Record<string, unknown> | undefined): boolean =>
  billing?.provider === 'stripe' && billing?.adminRestricted === true;

describe('addCleaningGroupMembersByManager business rules', () => {
  describe('canManageCleaningFromProfile', () => {
    it('allows an admin regardless of assignments', () => {
      expect(canManageCleaningFromProfile({ isActive: true, role: 'admin' })).toBe(true);
    });

    it('allows a cleaning manager via flat serviceAssignment fields', () => {
      expect(
        canManageCleaningFromProfile({
          isActive: true,
          role: 'user',
          servicePosition: 'encargado',
          serviceDepartment: 'limpieza',
        })
      ).toBe(true);
    });

    it('allows a cleaning manager whose limpieza assignment is not first in the array', () => {
      expect(
        canManageCleaningFromProfile({
          isActive: true,
          role: 'user',
          serviceAssignments: [
            { position: 'encargado', department: 'reuniones' },
            { position: 'encargado', department: 'limpieza' },
          ],
        })
      ).toBe(true);
    });

    it('allows a user with explicit permissions.limpieza.manage', () => {
      expect(
        canManageCleaningFromProfile({
          isActive: true,
          role: 'user',
          permissions: { limpieza: { manage: true } },
        })
      ).toBe(true);
    });

    it('denies a cleaning assistant (auxiliar)', () => {
      expect(
        canManageCleaningFromProfile({
          isActive: true,
          role: 'user',
          servicePosition: 'auxiliar',
          serviceDepartment: 'limpieza',
        })
      ).toBe(false);
    });

    it('denies a plain user with no assignments or permissions', () => {
      expect(canManageCleaningFromProfile({ isActive: true, role: 'user' })).toBe(false);
    });

    it('denies an inactive cleaning manager', () => {
      expect(
        canManageCleaningFromProfile({
          isActive: false,
          role: 'user',
          servicePosition: 'encargado',
          serviceDepartment: 'limpieza',
        })
      ).toBe(false);
    });
  });

  describe('hard delete authorization', () => {
    it('allows active admin roles used by Firestore rules', () => {
      expect(isCleaningGroupDeleteAdmin({ isActive: true, role: 'admin' })).toBe(true);
      expect(isCleaningGroupDeleteAdmin({ isActive: true, role: 'administrador' })).toBe(true);
    });

    it('denies a cleaning manager who is not an admin', () => {
      expect(
        isCleaningGroupDeleteAdmin({
          isActive: true,
          role: 'user',
          servicePosition: 'encargado',
          serviceDepartment: 'limpieza',
        })
      ).toBe(false);
    });

    it('denies an inactive admin', () => {
      expect(isCleaningGroupDeleteAdmin({ isActive: false, role: 'admin' })).toBe(false);
    });
  });

  describe('group resolution order', () => {
    it('picks the legacy root collection when the scoped ones do not exist', () => {
      // [congregations/{cid}/cleaningGroups, congregations/{cid}/cleaning_groups,
      //  cleaningGroups (raiz), cleaning_groups (raiz)]
      expect(resolveExistingCleaningGroupIndex([false, false, true, false])).toBe(2);
    });

    it('prefers the scoped collection when both exist', () => {
      expect(resolveExistingCleaningGroupIndex([true, false, false, false])).toBe(0);
    });

    it('returns -1 when the group does not exist in any collection', () => {
      expect(resolveExistingCleaningGroupIndex([false, false, false, false])).toBe(-1);
    });
  });

  describe('member limit', () => {
    it('rejects a resulting total above 200 members', () => {
      const resultingMemberIds = Array.from({ length: 205 }, (_, index) => `user-${index}`);
      expect(exceedsCleaningMemberLimit(resultingMemberIds)).toBe(true);
    });

    it('allows exactly 200 resulting members', () => {
      const resultingMemberIds = Array.from({ length: 200 }, (_, index) => `user-${index}`);
      expect(exceedsCleaningMemberLimit(resultingMemberIds)).toBe(false);
    });
  });

  describe('per-member resolution', () => {
    it('rejects a member who belongs to a different congregation than the group', () => {
      const outcome = resolveCleaningMemberOutcome(
        'ana-uid',
        { displayName: 'Ana', congregationId: 'c2' },
        'c1',
        'group-1',
        []
      );
      expect(outcome).toEqual({
        kind: 'error',
        message: 'El usuario "Ana" no pertenece a la congregacion del grupo.',
      });
    });

    it('rejects a member who already belongs to a different cleaning group', () => {
      const outcome = resolveCleaningMemberOutcome(
        'luis-uid',
        {
          displayName: 'Luis',
          congregationId: 'c1',
          cleaningGroupId: 'group-2',
          cleaningGroupName: 'Grupo B',
        },
        'c1',
        'group-1',
        []
      );
      expect(outcome).toEqual({
        kind: 'error',
        message: 'El usuario "Luis" ya pertenece a "Grupo B".',
      });
    });

    it('adds an active, eligible member with no prior group', () => {
      const outcome = resolveCleaningMemberOutcome(
        'carla-uid',
        { displayName: 'Carla', congregationId: 'c1', isActive: true },
        'c1',
        'group-1',
        []
      );
      expect(outcome).toEqual({ kind: 'added' });
    });

    it('re-adding the same group is not treated as a conflict', () => {
      const outcome = resolveCleaningMemberOutcome(
        'carla-uid',
        { displayName: 'Carla', congregationId: 'c1', isActive: true, cleaningGroupId: 'group-1' },
        'c1',
        'group-1',
        []
      );
      expect(outcome).toEqual({ kind: 'added' });
    });

    it('skips an inactive member without erroring', () => {
      const outcome = resolveCleaningMemberOutcome(
        'dan-uid',
        { displayName: 'Dan', congregationId: 'c1', isActive: false },
        'c1',
        'group-1',
        []
      );
      expect(outcome).toEqual({ kind: 'skipped' });
    });

    it('skips a member explicitly marked as not cleaningEligible', () => {
      const outcome = resolveCleaningMemberOutcome(
        'eva-uid',
        { displayName: 'Eva', congregationId: 'c1', isActive: true, cleaningEligible: false },
        'c1',
        'group-1',
        []
      );
      expect(outcome).toEqual({ kind: 'skipped' });
    });

    it('skips a member already present in the group memberIds (idempotent re-add)', () => {
      const outcome = resolveCleaningMemberOutcome(
        'fer-uid',
        { displayName: 'Fer', congregationId: 'c1', isActive: true },
        'c1',
        'group-1',
        ['fer-uid']
      );
      expect(outcome).toEqual({ kind: 'skipped' });
    });
  });

  describe('billing restriction', () => {
    it('blocks when the congregation has billing.adminRestricted true on Stripe', () => {
      expect(isDirectlyBillingRestricted({ provider: 'stripe', adminRestricted: true })).toBe(true);
    });

    it('does not block a normal Stripe congregation', () => {
      expect(isDirectlyBillingRestricted({ provider: 'stripe', adminRestricted: false })).toBe(false);
    });

    it('does not block when there is no billing data at all', () => {
      expect(isDirectlyBillingRestricted(undefined)).toBe(false);
    });
  });
});
