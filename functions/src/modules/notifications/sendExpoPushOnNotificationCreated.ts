import { Expo, ExpoPushMessage, ExpoPushReceipt, ExpoPushTicket } from 'expo-server-sdk';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

import { adminDb } from '../../config/firebaseAdmin.js';

const expo = new Expo();
const DEFAULT_CHANNEL_ID = 'default';
const MAX_PUSH_ATTEMPTS = 3;

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
        invalidatedAt: FieldValue.serverTimestamp(),
        lastError: 'DeviceNotRegistered',
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
};

const isDeviceNotRegisteredReceipt = (receipt: ExpoPushReceipt): boolean =>
  receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered';

const isTransientError = (error: unknown): boolean => {
  const status = typeof error === 'object' && error !== null && 'statusCode' in error
    ? (error as { statusCode?: unknown }).statusCode : null;
  return status === 429 || (typeof status === 'number' && status >= 500) ||
    error instanceof Error && /timeout|network|temporar/i.test(error.message);
};

const sendWithRetry = async (messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> => {
  let attempt = 0;
  while (true) {
    try {
      return await expo.sendPushNotificationsAsync(messages);
    } catch (error) {
      attempt += 1;
      if (attempt >= MAX_PUSH_ATTEMPTS || !isTransientError(error)) throw error;
      await new Promise<void>((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
    }
  }
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
    const singleUserId = asNonEmptyString(data.userId);
    const userIds = Array.from(
      new Set([
        ...asStringArray(data.userIds),
        ...(singleUserId ? [singleUserId] : []),
      ])
    );
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
        const tickets = await sendWithRetry(chunk);
        const receiptToToken = new Map<string, string>();

        await Promise.all(
          tickets.map(async (ticket, index) => {
            const token = chunk[index]?.to;
            const tokenValue = Array.isArray(token) ? token[0] : token;

            if (!tokenValue || typeof tokenValue !== 'string') {
              return;
            }

            if (isDeviceNotRegisteredTicket(ticket)) {
              const tokenDoc = tokenDocsByToken.get(tokenValue);

              if (tokenDoc?.tokenDocId) {
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
                message: ticket.message,
                details: ticket.details,
              });
            }
            if (ticket.status === 'ok') {
              receiptToToken.set(ticket.id, tokenValue);
              const tokenDoc = tokenDocsByToken.get(tokenValue);
              if (tokenDoc) {
                await snapshot.ref.collection('pushReceipts').doc(ticket.id).set({
                  userId: tokenDoc.userId,
                  tokenDocId: tokenDoc.tokenDocId,
                  congregationId,
                  status: 'pending',
                  attempts: 0,
                  createdAt: FieldValue.serverTimestamp(),
                  updatedAt: FieldValue.serverTimestamp(),
                });
              }
            }
          })
        );
        for (const receiptIds of expo.chunkPushNotificationReceiptIds(
          Array.from(receiptToToken.keys())
        )) {
          const receipts = await expo.getPushNotificationReceiptsAsync(receiptIds);
          await Promise.all(Object.entries(receipts).map(async ([receiptId, receipt]) => {
            if (!isDeviceNotRegisteredReceipt(receipt)) return;
            const tokenValue = receiptToToken.get(receiptId);
            const tokenDoc = tokenValue ? tokenDocsByToken.get(tokenValue) : null;
            if (tokenValue && tokenDoc?.tokenDocId) {
              await deactivateTokenDoc(tokenDoc.userId, tokenDoc.tokenDocId, tokenValue);
            }
          }));
          logger.info('Expo push receipts processed', {
            congregationId,
            notificationId,
            receiptSuccessCount: Object.values(receipts).filter((receipt) => receipt.status === 'ok').length,
            receiptErrorCount: Object.values(receipts).filter((receipt) => receipt.status === 'error').length,
          });
          await Promise.all(Object.entries(receipts).map(([receiptId, receipt]) =>
            snapshot.ref.collection('pushReceipts').doc(receiptId).set({
              status: receipt.status === 'ok' ? 'accepted' : 'error',
              receiptError: receipt.status === 'error' ? receipt.details?.error ?? 'unknown' : null,
              updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true })
          ));
        }
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
