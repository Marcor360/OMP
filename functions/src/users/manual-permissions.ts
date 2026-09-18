import type { Role, UserPermissions } from './types.js';

export type ManualPermissionsDecision =
  | { action: 'preserve' }
  | { action: 'remove' }
  | { action: 'set'; permissions: UserPermissions };

/** Manual permissions belong exclusively to supervisors. */
export const decideManualPermissionsUpdate = (params: {
  nextRole: Role;
  permissionsProvided: boolean;
  permissions?: UserPermissions;
  sanitize: (permissions: UserPermissions) => UserPermissions | undefined;
}): ManualPermissionsDecision => {
  if (params.nextRole !== 'supervisor') return { action: 'remove' };
  if (!params.permissionsProvided) return { action: 'preserve' };
  if (!params.permissions || Object.keys(params.permissions).length === 0) return { action: 'remove' };

  const safe = params.sanitize(params.permissions);
  return safe && Object.keys(safe).length > 0
    ? { action: 'set', permissions: safe }
    : { action: 'remove' };
};
