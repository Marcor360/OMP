/**
 * Fuente UNICA de autorizacion de eventos (avisos).
 * PURO: prohibido importar firebase, firebase-admin o react-native aqui.
 * Espejo de canManageEvents() de src/utils/permissions/permissions.ts:408
 * y de canManageEvents() de firestore.rules:371.
 */
export type EventsAvisosAction = 'view' | 'create' | 'edit' | 'delete' | 'manage';

export interface EventsUser {
  role?: 'admin' | 'supervisor' | 'user' | string;
  isActive?: boolean;
  congregationId?: string;
}

export interface EventsAccessDeps {
  hasAvisosPermission: (action: EventsAvisosAction) => boolean;
}

export const canManageEvents = (
  user: EventsUser | null | undefined,
  deps: EventsAccessDeps
): boolean =>
  user?.role === 'admin' ||
  deps.hasAvisosPermission('manage') ||
  (deps.hasAvisosPermission('create') && deps.hasAvisosPermission('edit'));
