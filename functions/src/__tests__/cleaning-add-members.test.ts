/**
 * Pruebas unitarias — addCleaningGroupMembersByManager (PR 8)
 *
 * Verifica los helpers puros de autorizacion y resolucion de negocio usados por
 * addCleaningGroupMembersByManager (functions/src/cleaning.ts), que no dependen
 * de Firestore. Espejo deliberado de esas funciones, al estilo de
 * hospitality-substitution.test.ts: cleaning.ts no las exporta, asi que se
 * replican aqui. Si cambia la logica en cleaning.ts, hay que actualizar este
 * archivo tambien.
 */

type CleaningAssignmentLike = { position?: unknown; department?: unknown };

const hasEncargadoLimpiezaAssignment = (user: Record<string, unknown>): boolean => {
  if (user.servicePosition === 'encargado' && user.serviceDepartment === 'limpieza') {
    return true;
  }

  const assignments = Array.isArray(user.serviceAssignments)
    ? (user.serviceAssignments as CleaningAssignmentLike[])
    : [];

  return assignments.some(
    (assignment) => assignment?.position === 'encargado' && assignment?.department === 'limpieza'
  );
};

const storedLimpiezaFlag = (user: Record<string, unknown>, action: string): boolean => {
  const permissions = user.permissions;
  if (typeof permissions !== 'object' || permissions === null) return false;

  const limpieza = (permissions as Record<string, unknown>).limpieza;
  if (typeof limpieza !== 'object' || limpieza === null) return false;

  return (limpieza as Record<string, unknown>)[action] === true;
};

const canManageCleaningFromProfile = (user: Record<string, unknown>): boolean => {
  if (user.isActive !== true) return false;
  if (user.role === 'admin' || user.role === 'administrador') return true;
  if (storedLimpiezaFlag(user, 'manage')) return true;
  if (storedLimpiezaFlag(user, 'create') && storedLimpiezaFlag(user, 'edit')) return true;
  return hasEncargadoLimpiezaAssignment(user);
};

const resolveCleaningMemberActive = (user: Record<string, unknown>): boolean => {
  if (typeof user.isActive === 'boolean') return user.isActive;
  if (typeof user.active === 'boolean') return user.active;
  if (typeof user.status === 'string') return user.status === 'active';
  return false;
};

// Espejo de la resolucion de grupo dentro de la transaccion: prueba las 4 rutas
// candidatas en orden y usa la primera que exista.
const resolveGroupIndex = (existsFlags: boolean[]): number => existsFlags.findIndex(Boolean);

type MemberOutcome =
  | { kind: 'added' }
  | { kind: 'skipped' }
  | { kind: 'error'; message: string };

// Espejo de la decision por integrante dentro de la transaccion de
// addCleaningGroupMembersByManager (functions/src/cleaning.ts).
const resolveMemberOutcome = (
  memberId: string,
  member: Record<string, unknown>,
  requesterCongregationId: string,
  targetGroupId: string,
  currentMemberIds: string[]
): MemberOutcome => {
  const displayName = typeof member.displayName === 'string' ? member.displayName : 'uid';
  const memberCongregationId =
    typeof member.congregationId === 'string' ? member.congregationId : '';

  if (memberCongregationId !== requesterCongregationId) {
    return {
      kind: 'error',
      message: `El usuario "${displayName}" no pertenece a la congregacion del grupo.`,
    };
  }

  const existingGroupId =
    typeof member.cleaningGroupId === 'string' && member.cleaningGroupId.length > 0
      ? member.cleaningGroupId
      : null;

  if (existingGroupId && existingGroupId !== targetGroupId) {
    const existingName =
      typeof member.cleaningGroupName === 'string' ? member.cleaningGroupName : 'otro grupo';
    return {
      kind: 'error',
      message: `El usuario "${displayName}" ya pertenece a "${existingName}".`,
    };
  }

  const active = resolveCleaningMemberActive(member);
  const eligible = typeof member.cleaningEligible === 'boolean' ? member.cleaningEligible : true;

  if (!active || !eligible || currentMemberIds.includes(memberId)) {
    return { kind: 'skipped' };
  }

  return { kind: 'added' };
};

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

  describe('group resolution order', () => {
    it('picks the legacy root collection when the scoped ones do not exist', () => {
      // [congregations/{cid}/cleaningGroups, congregations/{cid}/cleaning_groups,
      //  cleaningGroups (raiz), cleaning_groups (raiz)]
      expect(resolveGroupIndex([false, false, true, false])).toBe(2);
    });

    it('prefers the scoped collection when both exist', () => {
      expect(resolveGroupIndex([true, false, false, false])).toBe(0);
    });

    it('returns -1 when the group does not exist in any collection', () => {
      expect(resolveGroupIndex([false, false, false, false])).toBe(-1);
    });
  });

  describe('per-member resolution', () => {
    it('rejects a member who belongs to a different congregation than the group', () => {
      const outcome = resolveMemberOutcome(
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
      const outcome = resolveMemberOutcome(
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
      const outcome = resolveMemberOutcome(
        'carla-uid',
        { displayName: 'Carla', congregationId: 'c1', isActive: true },
        'c1',
        'group-1',
        []
      );
      expect(outcome).toEqual({ kind: 'added' });
    });

    it('re-adding the same group is not treated as a conflict', () => {
      const outcome = resolveMemberOutcome(
        'carla-uid',
        { displayName: 'Carla', congregationId: 'c1', isActive: true, cleaningGroupId: 'group-1' },
        'c1',
        'group-1',
        []
      );
      expect(outcome).toEqual({ kind: 'added' });
    });

    it('skips an inactive member without erroring', () => {
      const outcome = resolveMemberOutcome(
        'dan-uid',
        { displayName: 'Dan', congregationId: 'c1', isActive: false },
        'c1',
        'group-1',
        []
      );
      expect(outcome).toEqual({ kind: 'skipped' });
    });

    it('skips a member explicitly marked as not cleaningEligible', () => {
      const outcome = resolveMemberOutcome(
        'eva-uid',
        { displayName: 'Eva', congregationId: 'c1', isActive: true, cleaningEligible: false },
        'c1',
        'group-1',
        []
      );
      expect(outcome).toEqual({ kind: 'skipped' });
    });

    it('skips a member already present in the group memberIds (idempotent re-add)', () => {
      const outcome = resolveMemberOutcome(
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
