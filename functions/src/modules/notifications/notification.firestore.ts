import { FieldValue } from 'firebase-admin/firestore';

import { adminDb } from '../../config/firebaseAdmin.js';
import {
  NotificationDocument,
  NotificationMetadata,
  UserNotificationSettings,
} from './notification.types.js';

const USERS_COLLECTION = 'users';
const CLEANING_GROUPS_COLLECTION = 'cleaningGroups';
const CLEANING_GROUPS_LEGACY_COLLECTION = 'cleaning_groups';
const NOTIFICATIONS_COLLECTION = 'notifications';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => isNonEmptyString(item))
    .map((item) => item.trim());
};

const dedupeStrings = (items: string[]): string[] => {
  return Array.from(new Set(items.filter((item) => item.trim().length > 0)));
};

const normalizeStatus = (value: unknown): 'active' | 'inactive' | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();

  if (normalized === 'active' || normalized === 'activo') {
    return 'active';
  }

  if (
    normalized === 'inactive' ||
    normalized === 'inactivo' ||
    normalized === 'suspended' ||
    normalized === 'suspendido'
  ) {
    return 'inactive';
  }

  return null;
};

const resolveUserIsActive = (data: Record<string, unknown>): boolean => {
  if (typeof data.isActive === 'boolean') {
    return data.isActive;
  }

  if (typeof data.active === 'boolean') {
    return data.active;
  }

  return normalizeStatus(data.status) === 'active';
};

const resolveNotificationTokens = (data: Record<string, unknown>): string[] => {
  const aggregate = [
    ...asStringArray(data.notificationTokens),
    ...asStringArray(data.expoPushTokens),
    ...asStringArray(data.pushTokens),
  ];

  if (isNonEmptyString(data.expoPushToken)) {
    aggregate.push(data.expoPushToken.trim());
  }

  if (isNonEmptyString(data.pushToken)) {
    aggregate.push(data.pushToken.trim());
  }

  if (isNonEmptyString(data.notificationToken)) {
    aggregate.push(data.notificationToken.trim());
  }

  return dedupeStrings(aggregate);
};

export const getCleaningGroupMemberIds = async (
  groupId: string | null | undefined,
  congregationId?: string | null
): Promise<string[]> => {
  if (!groupId || groupId.trim().length === 0) {
    return [];
  }

  const groupIdValue = groupId.trim();
  const refs = congregationId && congregationId.trim().length > 0
    ? [
        adminDb
          .collection('congregations')
          .doc(congregationId.trim())
          .collection(CLEANING_GROUPS_COLLECTION)
          .doc(groupIdValue),
        adminDb
          .collection('congregations')
          .doc(congregationId.trim())
          .collection(CLEANING_GROUPS_LEGACY_COLLECTION)
          .doc(groupIdValue),
        adminDb.collection(CLEANING_GROUPS_COLLECTION).doc(groupIdValue),
        adminDb.collection(CLEANING_GROUPS_LEGACY_COLLECTION).doc(groupIdValue),
      ]
    : [
        adminDb.collection(CLEANING_GROUPS_COLLECTION).doc(groupIdValue),
        adminDb.collection(CLEANING_GROUPS_LEGACY_COLLECTION).doc(groupIdValue),
      ];

  for (const ref of refs) {
    const snap = await ref.get();

    if (!snap.exists) {
      continue;
    }

    const data = snap.data() as Record<string, unknown>;
    return dedupeStrings(asStringArray(data.memberIds));
  }

  return [];
};

export const getUserNotificationSettings = async (
  uid: string
): Promise<UserNotificationSettings | null> => {
  const snap = await adminDb.collection(USERS_COLLECTION).doc(uid).get();

  if (!snap.exists) {
    return null;
  }

  const data = snap.data() as Record<string, unknown>;

  const tokens = resolveNotificationTokens(data);

  return {
    uid,
    congregationId: isNonEmptyString(data.congregationId) ? data.congregationId : null,
    isActive: resolveUserIsActive(data),
    notificationTokens: tokens,
    notificationsEnabled: data.notificationsEnabled !== false,
    platformNotifications: data.platformNotifications !== false,
    cleaningNotifications: data.cleaningNotifications !== false,
    hospitalityNotifications: data.hospitalityNotifications !== false,
  };
};

export const createInternalNotification = async (params: {
  notificationId: string;
  userId: string;
  congregationId: string | null;
  category: NotificationDocument['category'];
  title: string;
  body: string;
  assignmentId: string;
  sentBy: string | null;
  metadata: NotificationMetadata;
}): Promise<void> => {
  const payload: NotificationDocument = {
    userId: params.userId,
    congregationId: params.congregationId,
    type: 'assignment',
    category: params.category,
    title: params.title,
    body: params.body,
    assignmentId: params.assignmentId,
    isRead: false,
    createdAt: FieldValue.serverTimestamp(),
    sentBy: params.sentBy,
    metadata: params.metadata,
  };

  await adminDb.collection(NOTIFICATIONS_COLLECTION).doc(params.notificationId).set(payload);
};

export const removeInvalidTokens = async (
  uid: string,
  invalidTokens: string[]
): Promise<void> => {
  const tokens = dedupeStrings(invalidTokens);

  if (tokens.length === 0) {
    return;
  }

  await adminDb.collection(USERS_COLLECTION).doc(uid).update({
    notificationTokens: FieldValue.arrayRemove(...tokens),
    updatedAt: FieldValue.serverTimestamp(),
  });
};
