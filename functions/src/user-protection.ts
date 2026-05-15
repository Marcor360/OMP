export const SYSTEM_ACTOR_LABEL = 'Sistema Sistema';

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

const PROTECTION_FLAG_KEYS = [
  'protectedFromDeletion',
  'isSystemUser',
  'isPrimaryAdmin',
  'isRootAdmin',
  'systemProtected',
] as const;

const SYSTEM_ACTOR_KEYS = [
  'createdBy',
  'createdByName',
  'createdByEmail',
] as const;

const normalizeMarker = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
};

const hasProtectionFlag = (data: Record<string, unknown>): boolean =>
  PROTECTION_FLAG_KEYS.some((key) => data[key] === true);

const hasSystemCreatorMarker = (data: Record<string, unknown>): boolean =>
  SYSTEM_ACTOR_KEYS.some((key) => {
    const marker = normalizeMarker(data[key]);
    return marker !== null && SYSTEM_ACTOR_VALUES.has(marker);
  });

export const isSystemPrincipalUser = (data: Record<string, unknown>): boolean =>
  hasProtectionFlag(data) || hasSystemCreatorMarker(data);
