/**
 * Fuente unica de autorizacion y decisiones puras del modulo de limpieza.
 * PURO: prohibido importar firebase, firebase-admin o react-native aqui.
 */

export const MAX_CLEANING_MEMBERS = 200;

type CleaningAssignmentLike = { position?: unknown; department?: unknown };

export const hasEncargadoLimpiezaAssignment = (
  user: Record<string, unknown>
): boolean => {
  if (user.servicePosition === 'encargado' && user.serviceDepartment === 'limpieza') {
    return true;
  }

  const assignments = Array.isArray(user.serviceAssignments)
    ? (user.serviceAssignments as CleaningAssignmentLike[])
    : [];

  return assignments.some(
    (assignment) =>
      assignment?.position === 'encargado' && assignment?.department === 'limpieza'
  );
};

export const storedLimpiezaFlag = (
  user: Record<string, unknown>,
  action: string
): boolean => {
  const permissions = user.permissions;
  if (typeof permissions !== 'object' || permissions === null) return false;

  const limpieza = (permissions as Record<string, unknown>).limpieza;
  if (typeof limpieza !== 'object' || limpieza === null) return false;

  return (limpieza as Record<string, unknown>)[action] === true;
};

// Espejo de canManageCleaning (frontend): admin | limpieza.manage |
// (limpieza.create && limpieza.edit) | encargado de limpieza.
export const canManageCleaningFromProfile = (
  user: Record<string, unknown>
): boolean => {
  if (user.isActive !== true) return false;
  if (user.role === 'admin') return true;
  if (storedLimpiezaFlag(user, 'manage')) return true;
  if (storedLimpiezaFlag(user, 'create') && storedLimpiezaFlag(user, 'edit')) return true;
  return hasEncargadoLimpiezaAssignment(user);
};

export const isCleaningGroupDeleteAdmin = (
  user: Record<string, unknown>
): boolean =>
  user.isActive === true &&
  user.role === 'admin';

export const resolveCleaningMemberActive = (
  user: Record<string, unknown>
): boolean => {
  if (typeof user.isActive === 'boolean') return user.isActive;
  if (typeof user.active === 'boolean') return user.active;
  if (typeof user.status === 'string') return user.status === 'active';
  return false;
};

export type CleaningMemberOutcome =
  | { kind: 'added' }
  | { kind: 'skipped' }
  | { kind: 'error'; message: string };

export const resolveCleaningMemberOutcome = (
  memberId: string,
  member: Record<string, unknown>,
  requesterCongregationId: string,
  targetGroupId: string,
  currentMemberIds: string[]
): CleaningMemberOutcome => {
  const displayName =
    typeof member.displayName === 'string' ? member.displayName : memberId;
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
      typeof member.cleaningGroupName === 'string'
        ? member.cleaningGroupName
        : 'otro grupo';
    return {
      kind: 'error',
      message: `El usuario "${displayName}" ya pertenece a "${existingName}".`,
    };
  }

  const eligible =
    typeof member.cleaningEligible === 'boolean' ? member.cleaningEligible : true;
  if (
    !resolveCleaningMemberActive(member) ||
    !eligible ||
    currentMemberIds.includes(memberId)
  ) {
    return { kind: 'skipped' };
  }

  return { kind: 'added' };
};

export const exceedsCleaningMemberLimit = (memberIds: string[]): boolean =>
  memberIds.length > MAX_CLEANING_MEMBERS;

export const resolveExistingCleaningGroupIndex = (existsFlags: boolean[]): number =>
  existsFlags.findIndex(Boolean);
