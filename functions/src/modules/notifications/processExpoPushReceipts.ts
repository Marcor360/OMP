import { Expo, ExpoPushReceipt } from 'expo-server-sdk';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { adminDb } from '../../config/firebaseAdmin.js';

const expo = new Expo();
const PAGE_SIZE = 200;

const isDeviceNotRegistered = (receipt: ExpoPushReceipt): boolean =>
  receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered';

/** Revisa tickets que Expo aún no había convertido a receipt durante el trigger inicial. */
export const processPendingExpoPushReceipts = onSchedule(
  { schedule: 'every 5 minutes', region: 'us-central1', timeoutSeconds: 120, maxInstances: 1 },
  async () => {
    const pending = await adminDb.collectionGroup('pushReceipts')
      .where('status', '==', 'pending').limit(PAGE_SIZE).get();
    if (pending.empty) return;
    const receipts = await expo.getPushNotificationReceiptsAsync(pending.docs.map((doc) => doc.id));
    await Promise.all(pending.docs.map(async (doc) => {
      const receipt = receipts[doc.id];
      const data = doc.data();
      if (!receipt) {
        const attempts = typeof data.attempts === 'number' ? data.attempts + 1 : 1;
        await doc.ref.set({ attempts, status: attempts >= 12 ? 'unresolved' : 'pending', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        return;
      }
      if (isDeviceNotRegistered(receipt) && typeof data.userId === 'string' && typeof data.tokenDocId === 'string') {
        await adminDb.collection('users').doc(data.userId).collection('pushTokens').doc(data.tokenDocId).set({
          isActive: false, invalidatedAt: FieldValue.serverTimestamp(), lastError: 'DeviceNotRegistered', updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      await doc.ref.set({ status: receipt.status === 'ok' ? 'accepted' : 'error', receiptError: receipt.status === 'error' ? receipt.details?.error ?? 'unknown' : null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }));
    logger.info('Expo pending push receipts processed', { pending: pending.size });
  }
);
