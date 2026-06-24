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

export const sortListedUsers = (
  users: (Record<string, unknown> & { uid: string })[]
): (Record<string, unknown> & { uid: string })[] =>
  [...users].sort((left, right) => {
    const leftLabel = normalizeText(left.displayName) ?? normalizeText(left.email) ?? left.uid;
    const rightLabel = normalizeText(right.displayName) ?? normalizeText(right.email) ?? right.uid;
    return leftLabel.localeCompare(rightLabel, 'es');
  });
