export const SYSTEM_ACTOR_LABEL = 'Sistema Sistema';

const PROTECTION_FLAG_KEYS = [
  'protectedFromDeletion',
  'isSystemUser',
  'isPrimaryAdmin',
  'isRootAdmin',
  'systemProtected',
] as const;

const hasProtectionFlag = (data: Record<string, unknown>): boolean =>
  PROTECTION_FLAG_KEYS.some((key) => data[key] === true);

export const isSystemPrincipalUser = (data: Record<string, unknown>): boolean =>
  hasProtectionFlag(data);
