import { normalizeText } from './parsers.js';

export const sanitizeUserForList = (
  uid: string,
  data: Record<string, unknown>
): Record<string, unknown> & { uid: string } => {
  const allowedKeys = [
    'email',
    'displayName',
    'role',
    'congregationId',
    'isActive',
    'active',
    'status',
    'phone',
    'gender',
    'department',
    'servicePosition',
    'serviceDepartment',
    'serviceAssignments',
    'privileges',
    'responsibilities',
    'permissions',
    'isElder',
    'isMinisterialServant',
    'avatarUrl',
    'secondLastName',
    'cleaningEligible',
    'cleaningGroupId',
    'cleaningGroupName',
    'notificationsEnabled',
    'platformNotifications',
    'cleaningNotifications',
    'hospitalityNotifications',
    'createdBy',
    'createdByName',
    'createdByEmail',
    'updatedBy',
    'updatedByName',
    'updatedByEmail',
    'protectedFromDeletion',
    'isSystemUser',
    'isPrimaryAdmin',
    'isRootAdmin',
    'systemProtected',
    'createdAt',
    'updatedAt',
  ] as const;

  return allowedKeys.reduce<Record<string, unknown> & { uid: string }>(
    (acc, key) => {
      if (data[key] !== undefined) {
        acc[key] = data[key];
      }
      return acc;
    },
    { uid }
  );
};

export const sanitizeOrgChartUserForList = (
  uid: string,
  data: Record<string, unknown>
): Record<string, unknown> & { uid: string } => {
  const allowedKeys = [
    'displayName',
    'congregationId',
    'isActive',
    'active',
    'status',
    'department',
    'servicePosition',
    'serviceDepartment',
    'serviceAssignments',
  ] as const;

  return allowedKeys.reduce<Record<string, unknown> & { uid: string }>(
    (acc, key) => {
      if (data[key] !== undefined) {
        acc[key] = data[key];
      }
      return acc;
    },
    { uid }
  );
};

export const isActiveUserListRecord = (data: Record<string, unknown>): boolean => {
  if (typeof data.isActive === 'boolean') return data.isActive;
  if (typeof data.active === 'boolean') return data.active;
  if (data.status === 'inactive' || data.status === 'suspended') return false;
  return true;
};

const normalizedMarker = (value: unknown): string | null => {
  const marker = normalizeText(value)?.toLowerCase();
  return marker && marker.length > 0 ? marker : null;
};

export const isSystemPrincipalListRecord = (data: Record<string, unknown>): boolean => {
  return (
    data.protectedFromDeletion === true ||
    data.isSystemUser === true ||
    data.isPrimaryAdmin === true ||
    data.isRootAdmin === true ||
    data.systemProtected === true
  );
};

const canonicalUserKey = (user: Record<string, unknown> & { uid: string }): string => {
  const email = normalizedMarker(user.email);
  return email ?? `uid:${user.uid}`;
};

const preferUserRecord = (
  current: Record<string, unknown> & { uid: string },
  candidate: Record<string, unknown> & { uid: string }
): Record<string, unknown> & { uid: string } => {
  const currentActive = isActiveUserListRecord(current);
  const candidateActive = isActiveUserListRecord(candidate);
  if (currentActive !== candidateActive) return candidateActive ? candidate : current;

  const currentHasService = Array.isArray(current.serviceAssignments) && current.serviceAssignments.length > 0;
  const candidateHasService = Array.isArray(candidate.serviceAssignments) && candidate.serviceAssignments.length > 0;
  return candidateHasService && !currentHasService ? candidate : current;
};

export const getVisibleListedUsers = (
  users: (Record<string, unknown> & { uid: string })[]
): (Record<string, unknown> & { uid: string })[] => {
  const byCanonicalKey = new Map<string, Record<string, unknown> & { uid: string }>();

  users.filter((user) => !isSystemPrincipalListRecord(user)).forEach((user) => {
    const key = canonicalUserKey(user);
    const existing = byCanonicalKey.get(key);
    byCanonicalKey.set(key, existing ? preferUserRecord(existing, user) : user);
  });

  return sortListedUsers(Array.from(byCanonicalKey.values()));
};

export const sortListedUsers = (
  users: (Record<string, unknown> & { uid: string })[]
): (Record<string, unknown> & { uid: string })[] =>
  [...users].sort((left, right) => {
    const leftLabel = normalizeText(left.displayName) ?? normalizeText(left.email) ?? left.uid;
    const rightLabel = normalizeText(right.displayName) ?? normalizeText(right.email) ?? right.uid;
    return leftLabel.localeCompare(rightLabel, 'es');
  });
