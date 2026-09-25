import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';
import { FieldValue, Timestamp, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { adminDb } from '../../config/firebaseAdmin.js';
import { logOperationalMetric } from '../../shared/observability.js';
import {
  MAX_DURABLE_PUSH_ATTEMPTS,
  PUSH_DISPATCH_LEASE_MS,
  canClaimPushDispatch,
  durableBackoffMs,
  expoErrorCode,
  isPermanentExpoResult,
  isTransientTransportError,
  sanitizePushError,
} from './push-dispatch.helpers.js';

const expo = new Expo();
const BATCH_SIZE = 100;

type ClaimedDispatch = {
  congregationId: string;
  notificationId: string;
  userId: string;
  tokenDocId: string;
  attempts: number;
};

const claimDispatch = async (
  doc: QueryDocumentSnapshot,
  now: Timestamp
): Promise<ClaimedDispatch | null> => adminDb.runTransaction(async (transaction) => {
  const fresh = await transaction.get(doc.ref);
  const data = fresh.data() as Record<string, unknown> | undefined;
  if (!data) return null;
  const status = data.status;
  const leaseUntil = data.leaseUntil instanceof Timestamp ? data.leaseUntil : null;
  const claimable = canClaimPushDispatch(
    status,
    leaseUntil?.toMillis() ?? null,
    now.toMillis()
  );
  if (!claimable) return null;
  const attempts = typeof data.attempts === 'number' ? data.attempts + 1 : 1;
  transaction.set(doc.ref, {
    status: 'processing', attempts,
    processingStartedAt: now,
    leaseUntil: Timestamp.fromMillis(now.toMillis() + PUSH_DISPATCH_LEASE_MS),
    updatedAt: now,
  }, { merge: true });
  const fields = ['congregationId', 'notificationId', 'userId', 'tokenDocId'] as const;
  if (fields.some((field) => typeof data[field] !== 'string')) return null;
  return {
    congregationId: data.congregationId as string,
    notificationId: data.notificationId as string,
    userId: data.userId as string,
    tokenDocId: data.tokenDocId as string,
    attempts,
  };
});

const reschedule = async (
  doc: QueryDocumentSnapshot,
  attempt: number,
  errorClass: string,
  error: unknown
): Promise<void> => {
  const exhausted = attempt >= MAX_DURABLE_PUSH_ATTEMPTS;
  const nextAttemptAt = Timestamp.fromMillis(Date.now() + durableBackoffMs(attempt));
  await doc.ref.set({
    status: exhausted ? 'exhausted' : 'pending',
    nextAttemptAt,
    leaseUntil: FieldValue.delete(),
    lastErrorClass: errorClass,
    lastErrorMessage: sanitizePushError(error),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
};

const processDispatch = async (doc: QueryDocumentSnapshot): Promise<void> => {
  const now = Timestamp.now();
  const dispatch = await claimDispatch(doc, now);
  if (!dispatch) return;
  const notificationRef = doc.ref.parent.parent;
  if (!dispatch.tokenDocId) {
    try {
      const tokens = await adminDb.collection('users').doc(dispatch.userId).collection('pushTokens')
        .where('isActive', '==', true).where('congregationId', '==', dispatch.congregationId).get();
      await Promise.all(tokens.docs.map((tokenDoc) => adminDb.runTransaction(async (transaction) => {
        if (!notificationRef) return;
        const ref = notificationRef.collection('pushDispatches').doc(tokenDoc.id);
        if ((await transaction.get(ref)).exists) return;
        transaction.create(ref, {
          notificationId: dispatch.notificationId, congregationId: dispatch.congregationId,
          dispatchId: tokenDoc.id, userId: dispatch.userId, tokenDocId: tokenDoc.id,
          status: 'pending', attempts: 0, nextAttemptAt: Timestamp.now(),
          createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
          lastErrorClass: null, lastErrorMessage: null,
        });
      })));
      await doc.ref.set({ status: 'sent', leaseUntil: FieldValue.delete(), resolvedTokenCount: tokens.size, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    } catch (error) {
      await reschedule(doc, dispatch.attempts, 'token_lookup', error);
    }
    return;
  }
  const tokenSnap = await adminDb.collection('users').doc(dispatch.userId)
    .collection('pushTokens').doc(dispatch.tokenDocId).get();
  const tokenData = tokenSnap.data() as Record<string, unknown> | undefined;
  const token = typeof tokenData?.token === 'string' ? tokenData.token : '';
  if (!tokenSnap.exists || tokenData?.isActive !== true || tokenData?.congregationId !== dispatch.congregationId || !Expo.isExpoPushToken(token)) {
    await doc.ref.set({ status: 'permanent_error', leaseUntil: FieldValue.delete(), lastErrorClass: 'inactive_or_invalid_token', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return;
  }
  const notificationSnap = notificationRef ? await notificationRef.get() : null;
  const notification = notificationSnap?.data() as Record<string, unknown> | undefined;
  if (!notification || typeof notification.title !== 'string' || typeof notification.body !== 'string') {
    await doc.ref.set({ status: 'permanent_error', leaseUntil: FieldValue.delete(), lastErrorClass: 'missing_notification', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return;
  }
  const payloadData = notification.data && typeof notification.data === 'object' ? notification.data as Record<string, unknown> : {};
  const message: ExpoPushMessage = {
    to: token, title: notification.title, body: notification.body,
    sound: 'default', channelId: 'default',
    data: {
      ...payloadData,
      congregationId: dispatch.congregationId,
      notificationId: dispatch.notificationId,
    },
  };
  try {
    const [ticket]: ExpoPushTicket[] = await expo.sendPushNotificationsAsync([message]);
    if (!ticket) throw new Error('Expo returned no push ticket');
    if (ticket.status === 'ok') {
      await Promise.all([
        doc.ref.set({ status: 'sent', ticketId: ticket.id, leaseUntil: FieldValue.delete(), sentAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
        notificationRef?.collection('pushReceipts').doc(ticket.id).set({
          congregationId: dispatch.congregationId, notificationId: dispatch.notificationId,
          userId: dispatch.userId, tokenDocId: dispatch.tokenDocId,
          dispatchId: doc.id, status: 'pending', attempts: 0,
          nextCheckAt: Timestamp.fromMillis(Date.now() + 60_000),
          createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        }),
      ]);
      return;
    }
    const code = expoErrorCode(ticket) ?? 'unknown';
    if (isPermanentExpoResult(ticket)) {
      if (code === 'DeviceNotRegistered') {
        await tokenSnap.ref.set({ isActive: false, invalidatedAt: FieldValue.serverTimestamp(), lastError: code, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
      await doc.ref.set({ status: 'permanent_error', leaseUntil: FieldValue.delete(), lastErrorClass: code, lastErrorMessage: sanitizePushError(ticket.message), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return;
    }
    await reschedule(doc, dispatch.attempts, code, ticket.message);
  } catch (error) {
    if (isTransientTransportError(error)) {
      await reschedule(doc, dispatch.attempts, 'transport', error);
      return;
    }
    await doc.ref.set({ status: 'permanent_error', leaseUntil: FieldValue.delete(), lastErrorClass: 'transport_permanent', lastErrorMessage: sanitizePushError(error), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
};

export const processPendingExpoPushDispatches = onSchedule(
  { schedule: 'every 1 minutes', region: 'us-central1', timeoutSeconds: 240, memory: '512MiB', maxInstances: 1 },
  async () => {
    const startedAt = Date.now();
    const now = Timestamp.now();
    const [pending, expired] = await Promise.all([
      adminDb.collectionGroup('pushDispatches').where('status', '==', 'pending').where('nextAttemptAt', '<=', now).orderBy('nextAttemptAt').limit(BATCH_SIZE).get(),
      adminDb.collectionGroup('pushDispatches').where('status', '==', 'processing').where('leaseUntil', '<=', now).orderBy('leaseUntil').limit(BATCH_SIZE).get(),
    ]);
    const jobs = new Map([...pending.docs, ...expired.docs].map((doc) => [doc.ref.path, doc]));
    await Promise.allSettled(Array.from(jobs.values()).map(processDispatch));
    const durationMs = Date.now() - startedAt;
    logger.info('push_dispatch_worker_completed', { batchSize: jobs.size, durationMs });
    logOperationalMetric('notifications.push_dispatch_worker', {
      processed: jobs.size,
      recovered: expired.size,
      durationMs,
    });
  }
);
