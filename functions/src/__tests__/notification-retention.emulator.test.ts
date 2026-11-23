import { randomUUID } from 'node:crypto';
import { adminDb } from '../config/firebaseAdmin.js';
import { deleteNotificationPage } from '../maintenance/delete-notification-page.js';
import { migrateLegacyRootNotificationsPage } from '../maintenance/scheduled-notifications-cleanup.js';

const describeEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;
describeEmulator('notification retention', () => {
  it('removes delivery data with the notice and preserves a changed notice', async () => {
    const root = adminDb.collection('congregations').doc(randomUUID());
    const notices = root.collection('notifications');
    const old = notices.doc('expired');
    const changed = notices.doc('changed');
    const receipt = old.collection('pushReceipts').doc('r');
    const dispatch = old.collection('pushDispatches').doc('d');
    try {
      await Promise.all([old.set({ state: 1 }), changed.set({ state: 1 }), receipt.set({ pending: true }), dispatch.set({ pending: true })]);
      const page = await notices.get();
      await changed.update({ state: 2 });
      expect(await deleteNotificationPage(page.docs)).toEqual({ deleted: 1, errors: 0 });
      const [oldDoc, changedDoc, receiptDoc, dispatchDoc] = await adminDb.getAll(old, changed, receipt, dispatch);
      expect([oldDoc.exists, changedDoc.exists, receiptDoc.exists, dispatchDoc.exists]).toEqual([false, true, false, false]);
    } finally {
      await adminDb.recursiveDelete(root);
    }
  }, 30_000);

  it('preserves malformed legacy records and existing scoped notifications', async () => {
    const id = randomUUID();
    const congregation = adminDb.collection('congregations').doc(id);
    const legacy = adminDb.collection('notifications');
    const ready = legacy.doc(`${id}-ready`);
    const conflict = legacy.doc(`${id}-conflict`);
    const invalid = legacy.doc(`${id}-invalid`);
    const target = congregation.collection('notifications');
    try {
      await Promise.all([
        ready.set({ congregationId: id, userId: 'u1', title: 'To move' }),
        conflict.set({ congregationId: id, userId: 'u1', title: 'Legacy copy' }),
        invalid.set({ title: 'Unknown owner' }),
        target.doc(conflict.id).set({ title: 'New copy' }),
      ]);
      await migrateLegacyRootNotificationsPage();
      expect((await ready.get()).exists).toBe(false);
      expect((await target.doc(ready.id).get()).get('userIds')).toEqual(['u1']);
      expect((await target.doc(conflict.id).get()).get('title')).toBe('New copy');
      expect((await conflict.get()).exists).toBe(true);
      expect((await invalid.get()).exists).toBe(true);
    } finally {
      await Promise.all([ready.delete(), conflict.delete(), invalid.delete(), adminDb.recursiveDelete(congregation)]);
    }
  }, 30_000);
});
