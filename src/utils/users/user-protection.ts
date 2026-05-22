import { AppUser } from '@/src/types/user';

const SYSTEM_ACTOR_LABEL = 'Sistema Sistema';

const SYSTEM_ACTOR_VALUES = new Set([
  'system',
  'sistema',
  'system principal',
  'sistema principal',
  'main system',
  'sistema central',
  'tu_correo@gmail.com',
  SYSTEM_ACTOR_LABEL.toLowerCase(),
]);

const normalizeMarker = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
};

export const isSystemPrincipalUser = (
  user: Pick<
    AppUser,
    | 'email'
    | 'displayName'
    | 'createdBy'
    | 'createdByName'
    | 'createdByEmail'
    | 'protectedFromDeletion'
    | 'isSystemUser'
    | 'isPrimaryAdmin'
    | 'isRootAdmin'
    | 'systemProtected'
  > | null | undefined
): boolean => {
  if (!user) return false;

  if (
    user.protectedFromDeletion === true ||
    user.isSystemUser === true ||
    user.isPrimaryAdmin === true ||
    user.isRootAdmin === true ||
    user.systemProtected === true
  ) {
    return true;
  }

  return [user.email, user.displayName].some((value) => {
    const marker = normalizeMarker(value);
    return marker !== null && SYSTEM_ACTOR_VALUES.has(marker);
  });
};
