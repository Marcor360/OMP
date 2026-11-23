import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../../config/firebaseAdmin.js';

export const pushPreview = (locale: unknown) => ({
  title: 'OMP',
  body: locale === 'en' ? 'You have a new notification.' : locale === 'es'
    ? 'Tienes una notificación nueva.'
    : 'Nueva notificación · New notification',
});

export const invalidateMatchingPushToken = async (
  userId: string, tokenDocId: string, version: unknown,
): Promise<void> => {
  if (!(version instanceof Timestamp)) return;
  const ref = adminDb.collection('users').doc(userId).collection('pushTokens').doc(tokenDocId);
  await adminDb.runTransaction(async (transaction) => {
    const current = await transaction.get(ref);
    if (!current.updateTime?.isEqual(version)) return;
    transaction.update(ref, {
      isActive: false,
      invalidatedAt: FieldValue.serverTimestamp(),
      lastError: 'DeviceNotRegistered',
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
};
