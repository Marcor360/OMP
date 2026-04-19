import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { adminDb } from './config/firebaseAdmin.js';
import {
  createInternalNotification,
  getUserNotificationSettings,
} from './modules/notifications/notification.firestore.js';
import { sendPushToUser } from './modules/notifications/sendPushToUser.js';
import {
  MeetingAssignmentTarget,
  getPendingReminderTargets,
  getUnnotifiedPublishTargets,
  markPublishNotificationSentAt,
  markReminderSentAt,
  normalizeMeetingSectionsFromDoc,
  resolveMeetingDate,
  resolveMeetingType,
  toDateLabel,
  toFirestoreSectionsPayload,
} from './modules/meetings/meeting-sections.js';

type PublicationStatus = 'draft' | 'published';

const NOTIFICATION_REGION = 'us-central1';
const NOTIFICATION_TIME_ZONE = 'America/Mexico_City';

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const sanitizeIdChunk = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_-]/g, '_');

const resolvePublicationStatus = (
  value: unknown
): PublicationStatus => (value === 'draft' ? 'draft' : 'published');

const isPlatformNotificationEnabled = (settings: {
  notificationsEnabled: boolean;
  platformNotifications: boolean;
}): boolean => settings.notificationsEnabled && settings.platformNotifications;

const resolveMeetingContextFromPath = (
  path: string
): { congregationId: string; meetingId: string } | null => {
  const match = path.match(/^congregations\/([^/]+)\/meetings\/([^/]+)$/);
  if (!match) return null;

  return {
    congregationId: match[1],
    meetingId: match[2],
  };
};

const resolveMeetingDateLabel = (data: Record<string, unknown>): string => {
  const meetingDate = resolveMeetingDate(data);
  if (!meetingDate) return 'sin fecha';
  return toDateLabel(meetingDate);
};

const buildNotificationId = (params: {
  kind: 'publish' | 'update' | 'reminder';
  meetingId: string;
  assignmentKey: string;
  userId: string;
}): string => {
  return `meeting_${params.kind}_${sanitizeIdChunk(params.meetingId)}_${sanitizeIdChunk(
    params.assignmentKey
  )}_${sanitizeIdChunk(params.userId)}`;
};

const buildNotificationMessage = (params: {
  kind: 'publish' | 'update' | 'reminder';
  meetingType: 'midweek' | 'weekend';
  assignmentTitle: string;
  meetingDateLabel: string;
}): { title: string; body: string } => {
  const meetingLabel =
    params.meetingType === 'midweek'
      ? 'reunion Vida y Ministerio Cristianos'
      : 'reunion del fin de semana';

  if (params.kind === 'publish') {
    return {
      title: 'Reunion publicada',
      body: `Se publico la ${meetingLabel} del ${params.meetingDateLabel}. Asignacion: ${params.assignmentTitle}.`,
    };
  }

  if (params.kind === 'update') {
    return {
      title: 'Nueva asignacion en reunion publicada',
      body: `Tienes una nueva asignacion (${params.assignmentTitle}) para la ${meetingLabel} del ${params.meetingDateLabel}.`,
    };
  }

  return {
    title: 'Recordatorio de asignacion',
    body: `Recordatorio: ${params.assignmentTitle} en la ${meetingLabel} del ${params.meetingDateLabel}.`,
  };
};

const notifyMeetingTarget = async (params: {
  notificationKind: 'publish' | 'update' | 'reminder';
  congregationId: string;
  meetingId: string;
  meetingType: 'midweek' | 'weekend';
  meetingDateLabel: string;
  target: MeetingAssignmentTarget;
  sentBy: string | null;
}): Promise<boolean> => {
  const settings = await getUserNotificationSettings(params.target.userId);

  if (!settings || !settings.isActive) {
    return false;
  }

  if (
    settings.congregationId &&
    settings.congregationId !== params.congregationId
  ) {
    return false;
  }

  if (!isPlatformNotificationEnabled(settings)) {
    return false;
  }

  const message = buildNotificationMessage({
    kind: params.notificationKind,
    meetingType: params.meetingType,
    assignmentTitle: params.target.assignmentTitle,
    meetingDateLabel: params.meetingDateLabel,
  });

  const assignmentId = `${params.meetingId}:${params.target.assignmentKey}`;

  await createInternalNotification({
    notificationId: buildNotificationId({
      kind: params.notificationKind,
      meetingId: params.meetingId,
      assignmentKey: params.target.assignmentKey,
      userId: params.target.userId,
    }),
    userId: params.target.userId,
    congregationId: params.congregationId,
    category: 'platform',
    title: message.title,
    body: message.body,
    assignmentId,
    sentBy: params.sentBy,
    metadata: {
      date: params.meetingDateLabel,
      meetingType: params.meetingType,
      role: params.target.assignmentTitle,
    },
  });

  await sendPushToUser({
    uid: params.target.userId,
    tokens: settings.notificationTokens,
    title: message.title,
    body: message.body,
    assignmentId,
    category: 'platform',
    meetingType: params.meetingType,
    date: params.meetingDateLabel,
  });

  return true;
};

const processPublishedMeetingNotifications = async (params: {
  congregationId: string;
  meetingId: string;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown>;
}): Promise<void> => {
  const afterStatus = resolvePublicationStatus(params.afterData.publicationStatus);

  if (afterStatus !== 'published') {
    return;
  }

  const beforeStatus = resolvePublicationStatus(params.beforeData?.publicationStatus);

  const sections = normalizeMeetingSectionsFromDoc(params.afterData);
  const pendingTargets = getUnnotifiedPublishTargets(sections);

  if (pendingTargets.length === 0) {
    return;
  }

  const meetingType = resolveMeetingType(params.afterData);
  const meetingDateLabel = resolveMeetingDateLabel(params.afterData);
  const sentBy = normalizeText(params.afterData.updatedBy) ?? normalizeText(params.afterData.createdBy) ?? null;

  const notificationKind =
    beforeStatus !== 'published' ? 'publish' : 'update';

  const deliveredTargetKeys = new Set<string>();

  await Promise.all(
    pendingTargets.map(async (target) => {
      try {
        const delivered = await notifyMeetingTarget({
          notificationKind,
          congregationId: params.congregationId,
          meetingId: params.meetingId,
          meetingType,
          meetingDateLabel,
          target,
          sentBy,
        });

        if (delivered) {
          deliveredTargetKeys.add(target.targetKey);
        }
      } catch (error) {
        logger.error('Error enviando notificacion de reunion', {
          meetingId: params.meetingId,
          userId: target.userId,
          assignmentKey: target.assignmentKey,
          error,
        });
      }
    })
  );

  if (deliveredTargetKeys.size === 0) {
    return;
  }

  const now = Timestamp.now();
  const sectionsWithMarkers = markPublishNotificationSentAt(
    sections,
    deliveredTargetKeys,
    now
  );

  await adminDb
    .collection('congregations')
    .doc(params.congregationId)
    .collection('meetings')
    .doc(params.meetingId)
    .update({
      sections: toFirestoreSectionsPayload(sectionsWithMarkers),
      updatedAt: FieldValue.serverTimestamp(),
    });

  logger.info('Notificaciones de reunion procesadas', {
    meetingId: params.meetingId,
    congregationId: params.congregationId,
    delivered: deliveredTargetKeys.size,
    notificationKind,
  });
};

const processReminderForMeeting = async (params: {
  congregationId: string;
  meetingId: string;
  meetingData: Record<string, unknown>;
}): Promise<void> => {
  const publicationStatus = resolvePublicationStatus(
    params.meetingData.publicationStatus
  );

  if (publicationStatus !== 'published') {
    return;
  }

  const sections = normalizeMeetingSectionsFromDoc(params.meetingData);
  const pendingTargets = getPendingReminderTargets(sections);

  if (pendingTargets.length === 0) {
    return;
  }

  const meetingType = resolveMeetingType(params.meetingData);
  const meetingDateLabel = resolveMeetingDateLabel(params.meetingData);
  const sentBy = normalizeText(params.meetingData.updatedBy) ?? normalizeText(params.meetingData.createdBy) ?? null;

  const deliveredTargetKeys = new Set<string>();

  await Promise.all(
    pendingTargets.map(async (target) => {
      try {
        const delivered = await notifyMeetingTarget({
          notificationKind: 'reminder',
          congregationId: params.congregationId,
          meetingId: params.meetingId,
          meetingType,
          meetingDateLabel,
          target,
          sentBy,
        });

        if (delivered) {
          deliveredTargetKeys.add(target.targetKey);
        }
      } catch (error) {
        logger.error('Error enviando recordatorio de reunion', {
          meetingId: params.meetingId,
          userId: target.userId,
          assignmentKey: target.assignmentKey,
          error,
        });
      }
    })
  );

  if (deliveredTargetKeys.size === 0) {
    return;
  }

  const now = Timestamp.now();
  const sectionsWithMarkers = markReminderSentAt(
    sections,
    deliveredTargetKeys,
    now
  );

  await adminDb
    .collection('congregations')
    .doc(params.congregationId)
    .collection('meetings')
    .doc(params.meetingId)
    .update({
      sections: toFirestoreSectionsPayload(sectionsWithMarkers),
      updatedAt: FieldValue.serverTimestamp(),
    });

  logger.info('Recordatorios de reunion procesados', {
    meetingId: params.meetingId,
    congregationId: params.congregationId,
    delivered: deliveredTargetKeys.size,
  });
};

export const notifyMeetingPublicationAndChanges = onDocumentWritten(
  {
    region: NOTIFICATION_REGION,
    timeoutSeconds: 120,
    memory: '512MiB',
    maxInstances: 20,
    document: 'congregations/{congregationId}/meetings/{meetingId}',
  },
  async (event) => {
    const meetingId = event.params.meetingId;
    const congregationId = event.params.congregationId;

    if (!meetingId || !congregationId || !event.data?.after.exists) {
      return;
    }

    const beforeData = event.data.before.exists
      ? (event.data.before.data() as Record<string, unknown>)
      : null;
    const afterData = event.data.after.data() as Record<string, unknown>;

    await processPublishedMeetingNotifications({
      congregationId,
      meetingId,
      beforeData,
      afterData,
    });
  }
);

const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);

const endOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const datePlusDays = (base: Date, days: number): Date => {
  const next = new Date(base);
  next.setDate(base.getDate() + days);
  return next;
};

export const sendMeetingReminderThreeDaysBefore = onSchedule(
  {
    schedule: '0 8 * * *',
    timeZone: NOTIFICATION_TIME_ZONE,
    region: NOTIFICATION_REGION,
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async () => {
    const targetDate = datePlusDays(new Date(), 3);
    const targetStart = Timestamp.fromDate(startOfDay(targetDate));
    const targetEnd = Timestamp.fromDate(endOfDay(targetDate));

    const meetingsSnap = await adminDb
      .collectionGroup('meetings')
      .where('meetingDate', '>=', targetStart)
      .where('meetingDate', '<=', targetEnd)
      .get();

    logger.info('Iniciando recordatorios de reuniones', {
      totalMeetings: meetingsSnap.size,
      targetDay: targetDate.toISOString().slice(0, 10),
    });

    for (const meetingDoc of meetingsSnap.docs) {
      const context = resolveMeetingContextFromPath(meetingDoc.ref.path);
      if (!context) {
        continue;
      }

      await processReminderForMeeting({
        congregationId: context.congregationId,
        meetingId: context.meetingId,
        meetingData: meetingDoc.data() as Record<string, unknown>,
      });
    }
  }
);
