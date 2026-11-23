import { type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { adminDb } from '../config/firebaseAdmin.js';

export const deleteNotificationPage = async (docs: readonly QueryDocumentSnapshot[]) => {
  let errors = 0;
  let deleted = 0;
  for (let offset = 0; offset < docs.length; offset += 8) {
    const outcomes = await Promise.allSettled(docs.slice(offset, offset + 8).map(async (doc) => {
      const current = await doc.ref.get();
      if (!current.updateTime?.isEqual(doc.updateTime)) return false;
      const children = (await doc.ref.listCollections()).filter(({ id }) => id === 'pushReceipts' || id === 'pushDispatches');
      for (const child of children) {
        await adminDb.recursiveDelete(child);
      }
      await doc.ref.delete({ lastUpdateTime: doc.updateTime });
      return true;
    }));
    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') errors += 1;
      else if (outcome.value) deleted += 1;
    }
  }
  return { errors, deleted };
};
