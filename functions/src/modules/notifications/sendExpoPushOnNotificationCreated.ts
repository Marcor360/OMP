import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

import { adminDb } from '../../config/firebaseAdmin.js';

const expo = new Expo();
const DEFAULT_CHANNEL_ID = 'default';

const triggerOptions = {
  region: 'us-central1' as const,
  timeoutSeconds: 60,
  memory: '256MiB' as const,
  maxInstances: 3,
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
};

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isDeviceNotRegisteredTicket = (ticket: ExpoPushTicket): boolean => {
  return ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered';
};

const getActivePushTokenDocs = async (
  userId: string,
  congregationId: string
) => {
  const snap = await adminDb
    .collection('users')
    .doc(userId)
    .collection('pushTokens')
    .where('isActive', '==', true)
    .where('congregationId', '==', congregationId)
    .get();

  return snap.docs;
};

const deactivateTokenDoc = async (
  userId: string,
  tokenDocId: string,
  token: string
): Promise<void> => {
  await adminDb
    .collection('users')
    .doc(userId)
    .collection('pushTokens')
    .doc(tokenDocId)
    .set(
      {
        token,
        isActive: false,
        deactivatedReason: 'DeviceNotRegistered',
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
};

export const sendExpoPushOnNotificationCreated = onDocumentCreated(
  {
    ...triggerOptions,
    document: 'congregations/{congregationId}/notifications/{notificationId}',
  },
  async (event) => {
    const congregationId = event.params.congregationId;
    const notificationId = event.params.notificationId;
    const snapshot = event.data;

    if (!snapshot || !congregationId || !notificationId) {
      return;
    }

    const data = snapshot.data() as Record<string, unknown>;
    const userIds = Array.from(new Set(asStringArray(data.userIds)));
    const title = asNonEmptyString(data.title);
    const body = asNonEmptyString(data.body);
    const type = asNonEmptyString(data.type) ?? 'notification';
    const payloadData =
      data.data && typeof data.data === 'object'
        ? (data.data as Record<string, unknown>)
        : {};
    const url = asNonEmptyString(payloadData.url) ?? '/(protected)/notifications';

    if (userIds.length === 0 || !title || !body) {
      logger.info('Skipping Expo push: notification payload is incomplete', {
        congregationId,
        notificationId,
        userIds: userIds.length,
        hasTitle: Boolean(title),
        hasBody: Boolean(body),
      });
      return;
    }

    const tokenDocsByToken = new Map<
      string,
      { userId: string; tokenDocId: string }
    >();

    await Promise.all(
      userIds.map(async (userId) => {
        try {
          const tokenDocs = await getActivePushTokenDocs(userId, congregationId);

          tokenDocs.forEach((tokenDoc) => {
            const token = asNonEmptyString(tokenDoc.data().token);

            if (!token || !Expo.isExpoPushToken(token)) {
              return;
            }

            tokenDocsByToken.set(token, {
              userId,
              tokenDocId: tokenDoc.id,
            });
          });
        } catch (error) {
          logger.error('Failed to read Expo push tokens for user', {
            congregationId,
            notificationId,
            userId,
            error,
          });
        }
      })
    );

    const messages: ExpoPushMessage[] = Array.from(tokenDocsByToken.keys()).map(
      (token) => ({
        to: token,
        title,
        body,
        sound: 'default',
        channelId: DEFAULT_CHANNEL_ID,
        data: {
          url,
          type,
          congregationId,
          notificationId,
        },
      })
    );

    if (messages.length === 0) {
      logger.info('Skipping Expo push: no active Expo tokens found', {
        congregationId,
        notificationId,
        userIds: userIds.length,
      });
      return;
    }

    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);

        await Promise.all(
          tickets.map(async (ticket, index) => {
            const token = chunk[index]?.to;
            const tokenValue = Array.isArray(token) ? token[0] : token;

            if (!tokenValue || typeof tokenValue !== 'string') {
              return;
            }

            if (isDeviceNotRegisteredTicket(ticket)) {
              const tokenDoc = tokenDocsByToken.get(tokenValue);

              if (tokenDoc) {
                await deactivateTokenDoc(
                  tokenDoc.userId,
                  tokenDoc.tokenDocId,
                  tokenValue
                );
              }
              return;
            }

            if (ticket.status === 'error') {
              logger.error('Expo push ticket failed', {
                congregationId,
                notificationId,
                token: tokenValue,
                message: ticket.message,
                details: ticket.details,
              });
            }
          })
        );
      } catch (error) {
        logger.error('Expo push chunk failed', {
          congregationId,
          notificationId,
          error,
        });
      }
    }
  }
);
