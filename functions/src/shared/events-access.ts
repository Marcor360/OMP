/**
 * Fuente UNICA de autorizacion de eventos (avisos).
 * PURO: prohibido importar firebase, firebase-admin o react-native aqui.
 * El cliente refleja estos permisos para navegación. Firestore bloquea las
 * escrituras directas y las funciones vuelven a validar el perfil.
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
