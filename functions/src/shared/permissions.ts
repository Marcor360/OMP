/**
 * Fase 0 (F0.6) — hasPermission compartido para Cloud Functions.
 * PURO: prohibido importar firebase, firebase-admin o react-native aqui,
 * igual que functions/src/shared/cleaning-access.ts y
 * functions/src/shared/derived-permissions.ts.
 *
 * Espejo exacto de hasPermission()/permissionFlag() en
 * rules_src/04-department-permissions.rules. Si cambia alla, cambia aqui
 * tambien en el mismo PR -- la divergencia entre ambas copias es exactamente
 * el bug que Fase 0 cierra.
 */
import { UserPermissions } from './derived-permissions.js';

export type PermissionSourceProfile = {
  permissions?: UserPermissions;
  derivedPermissions?: UserPermissions;
};

const permissionFlag = (
  source: UserPermissions | null | undefined,
  department: string,
  action: string
): boolean => {
  const departmentPermissions = source?.[department as keyof UserPermissions];
  if (!departmentPermissions) return false;

  return (
    departmentPermissions[action as keyof typeof departmentPermissions] === true ||
    (action !== 'manage' && departmentPermissions.manage === true)
  );
};

// 'manage' sigue siendo superconjunto de las demas acciones, pero DENTRO de
// cada mapa por separado -- un 'manage' en permissions no se filtra a
// derivedPermissions ni viceversa, cada fuente se evalua de forma
// independiente (misma semantica que permissionFlag() en rules).
export const hasPermission = (
  requester: PermissionSourceProfile,
  department: string,
  action: string
): boolean =>
  permissionFlag(requester.permissions, department, action) ||
  permissionFlag(requester.derivedPermissions, department, action);
