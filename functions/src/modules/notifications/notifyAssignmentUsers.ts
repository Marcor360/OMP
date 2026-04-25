import { logger } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

import {
  buildNotificationMessage,
  diffNewUserIds,
  resolveAssignmentContext,
  resolveDirectAssignedUsers,
  resolveNotificationCategory,
  sanitizeRoleLabel,
} from './notification.helpers.js';
import {
  createInternalNotification,
  getCleaningGroupMemberIds,
  getUserNotificationSettings,
} from './notification.firestore.js';
import { sendPushToUser } from './sendPushToUser.js';
import {
  AssignmentNotificationContext,
  NotificationCategory,
  ResolvedAssignmentUsers,
} from './notification.types.js';

type PathParams = Record<string, string | undefined>;

type TriggerHandlerParams = {
  eventId: string;
  pathParams: PathParams;
  assignmentId: string;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown>;
};

const triggerOptions = {
  region: 'us-central1' as const,
  timeoutSeconds: 120,
  memory: '512MiB' as const,
  maxInstances: 20,
};

const normalizeNotificationId = (eventId: string, uid: string): string => {
  const safeEventId = eventId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `assign_${safeEventId}_${uid}`;
};

const isCategoryEnabledForUser = (
  category: NotificationCategory,
  settings: {
    notificationsEnabled: boolean;
    platformNotifications: boolean;
    cleaningNotifications: boolean;
    hospitalityNotifications: boolean;
  }
): boolean => {
  if (!settings.notificationsEnabled) {
    return false;
  }

  if (category === 'platform') {
    return settings.platformNotifications;
  }

  if (category === 'cleaning') {
    return settings.cleaningNotifications;
  }

  return settings.hospitalityNotifications;
};

const resolveAssignedUsers = async (
  data: Record<string, unknown>,
  category: NotificationCategory
): Promise<ResolvedAssignmentUsers> => {
  if (category === 'cleaning') {
    const groupId = typeof data.cleaningGroupId === 'string' ? data.cleaningGroupId : null;
    const congregationId =
      typeof data.congregationId === 'string' ? data.congregationId : null;
    const members = await getCleaningGroupMemberIds(groupId, congregationId);

    return {
      userIds: new Set(members),
      roleByUserId: new Map<string, string>(),
    };
  }

  return resolveDirectAssignedUsers(data, category);
};

const resolveBeforeUsers = async (
  beforeData: Record<string, unknown> | null,
  fallbackCategory: NotificationCategory
): Promise<Set<string>> => {
  if (!beforeData) {
    return new Set<string>();
  }

  const beforeCategory = resolveNotificationCategory(beforeData) ?? fallbackCategory;
  const beforeUsers = await resolveAssignedUsers(beforeData, beforeCategory);
  return beforeUsers.userIds;
};

const notifySingleUser = async (params: {
  uid: string;
  context: AssignmentNotificationContext;
  role: string | null;
  eventId: string;
  title: string;
  body: string;
}): Promise<void> => {
  const userSettings = await getUserNotificationSettings(params.uid);

  if (!userSettings) {
    logger.warn('User profile not found for notification', {
      uid: params.uid,
      assignmentId: params.context.assignmentId,
    });
    return;
  }

  if (!userSettings.isActive) {
    return;
  }

  if (
    params.context.congregationId &&
    userSettings.congregationId &&
    params.context.congregationId !== userSettings.congregationId
  ) {
    logger.warn('Skipping notification due to congregation mismatch', {
      uid: params.uid,
      assignmentId: params.context.assignmentId,
      assignmentCongregationId: params.context.congregationId,
      userCongregationId: userSettings.congregationId,
    });
    return;
  }

  if (!isCategoryEnabledForUser(params.context.category, userSettings)) {
    return;
  }

  const notificationId = normalizeNotificationId(params.eventId, params.uid);

  await createInternalNotification({
    notificationId,
    userId: params.uid,
    congregationId: params.context.congregationId,
    category: params.context.category,
    title: params.title,
    body: params.body,
    assignmentId: params.context.assignmentId,
    sentBy: params.context.sentBy,
    metadata: {
      date: params.context.date,
      meetingType: params.context.meetingType,
      role: params.role,
    },
  });

  await sendPushToUser({
    uid: params.uid,
    tokens: userSettings.notificationTokens,
    title: params.title,
    body: params.body,
    assignmentId: params.context.assignmentId,
    category: params.context.category,
    meetingType: params.context.meetingType,
    date: params.context.date,
  });
};

const processAssignmentWrite = async (
  params: TriggerHandlerParams
): Promise<void> => {
  const context = resolveAssignmentContext({
    assignmentId: params.assignmentId,
    data: params.afterData,
    pathParams: params.pathParams,
  });

  if (!context) {
    logger.debug('Skipping assignment write: unsupported category', {
      assignmentId: params.assignmentId,
      eventId: params.eventId,
    });
    return;
  }

  const beforeUserIds = await resolveBeforeUsers(params.beforeData, context.category);
  const afterUsers = await resolveAssignedUsers(params.afterData, context.category);

  const newUserIds = diffNewUserIds(beforeUserIds, afterUsers.userIds);

  if (newUserIds.length === 0) {
    return;
  }

  const message = buildNotificationMessage({
    category: context.category,
    date: context.date,
    meetingType: context.meetingType,
  });

  await Promise.all(
    newUserIds.map(async (uid) => {
      await notifySingleUser({
        uid,
        context,
        role: sanitizeRoleLabel(afterUsers.roleByUserId.get(uid)),
        eventId: params.eventId,
        title: message.title,
        body: message.body,
      });
    })
  );

  logger.info('Assignment notifications processed', {
    eventId: params.eventId,
    assignmentId: params.assignmentId,
    congregationId: context.congregationId,
    category: context.category,
    newUsers: newUserIds.length,
  });
};

const createAssignmentNotificationTrigger = (documentPath: string) => {
  return onDocumentWritten(
    {
      ...triggerOptions,
      document: documentPath,
    },
    async (event) => {
      const assignmentId = event.params.assignmentId;
      const snapshot = event.data;

      if (!assignmentId || !snapshot) {
        return;
      }

      const beforeData = snapshot.before.exists
        ? (snapshot.before.data() as Record<string, unknown>)
        : null;

      if (!snapshot.after.exists) {
        return;
      }

      const afterData = snapshot.after.data() as Record<string, unknown>;

      try {
        await processAssignmentWrite({
          eventId: event.id,
          assignmentId,
          pathParams: event.params,
          beforeData,
          afterData,
        });
      } catch (error) {
        logger.error('notifyAssignmentUsers failed', {
          assignmentId,
          eventId: event.id,
          path: documentPath,
          error,
        });
        throw error;
      }
    }
  );
};

export const notifyAssignmentUsers = createAssignmentNotificationTrigger(
  'assignments/{assignmentId}'
);

export const notifyCongregationAssignmentUsers =
  createAssignmentNotificationTrigger(
    'congregations/{congregationId}/assignments/{assignmentId}'
  );

export const notifyMeetingAssignmentUsers = createAssignmentNotificationTrigger(
  'congregations/{congregationId}/meetings/{meetingId}/assignments/{assignmentId}'
);
