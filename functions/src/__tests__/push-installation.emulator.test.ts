import { createHash, randomUUID } from 'node:crypto';
import { adminDb } from '../config/firebaseAdmin.js';
import { bindPushInstallation, revokePushInstallation } from '../modules/notifications/push-installation.js';
import { invalidateMatchingPushToken, pushPreview } from '../modules/notifications/push-token-version.js';

const describeEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const docId = (value: string) => encodeURIComponent(value).replace(/\./g, '%2E');

describeEmulator('push installation lifecycle', () => {
  it('ignores stale invalidations and never recreates a removed token', async () => {
    const uid = randomUUID();
    const token = adminDb.collection('users').doc(uid).collection('pushTokens').doc('synthetic');
    try {
      await token.set({ isActive: true });
      const old = await token.get();
      await token.update({ locale: 'en' });
      await invalidateMatchingPushToken(uid, token.id, old.updateTime);
      const current = await token.get();
      expect(current.get('isActive')).toBe(true);
      await invalidateMatchingPushToken(uid, token.id, current.updateTime);
      expect((await token.get()).get('isActive')).toBe(false);
      await token.delete();
      await invalidateMatchingPushToken(uid, token.id, current.updateTime);
      expect((await token.get()).exists).toBe(false);
    } finally {
      await token.delete();
    }
  });
  it('revokes only the matching installation and protects a later account on the same device', async () => {
    const [accountA, accountB, firstDevice, secondDevice, switched] = Array.from({ length: 5 }, () => randomUUID());
    const token = `ExpoPushToken[${firstDevice}]`;
    const otherToken = `ExpoPushToken[${secondDevice}]`;
    const users = adminDb.collection('users');
    const lookup = (uid: string, value: string) => users.doc(uid).collection('pushTokens').doc(docId(value)).get();
    const bind = (uid: string, value: string, key: string, previousKey?: string, actor = uid) => bindPushInstallation.run({
      auth: { uid: actor, token: { uid: actor } },
      data: { uid, token: value, key, previousKey, issuedAt: Date.now(), platform: 'android', congregationId: 'demo-cong' },
    } as Parameters<typeof bindPushInstallation.run>[0]);
    const revoke = (value: string, key: string) => revokePushInstallation.run({
      data: { token: value, key },
    } as Parameters<typeof revokePushInstallation.run>[0]);

    try {
      await Promise.all([accountA, accountB].map((uid) =>
        users.doc(uid).set({ isActive: true, congregationId: 'demo-cong' })
      ));
      await bind(accountA, token, firstDevice);
      await bind(accountA, otherToken, secondDevice);
      await expect(bind(accountB, token, switched, undefined)).rejects.toMatchObject({ code: 'permission-denied' });
      await expect(bind(accountB, token, switched, firstDevice, accountA)).rejects.toMatchObject({ code: 'permission-denied' });

      await bind(accountB, token, switched, firstDevice);
      await expect(revoke(token, firstDevice)).resolves.toEqual({ revoked: true });
      expect((await lookup(accountB, token)).exists).toBe(true);
      expect((await lookup(accountA, token)).exists).toBe(false);
      await expect(revoke(token, secondDevice)).resolves.toEqual({ revoked: false });
      await expect(revoke(token, switched)).resolves.toEqual({ revoked: true });
      await expect(bind(accountB, token, switched)).rejects.toMatchObject({ code: 'failed-precondition' });
      expect((await lookup(accountB, token)).exists).toBe(false);
      expect((await lookup(accountA, otherToken)).exists).toBe(true);
    } finally {
      await Promise.all([
        ...[accountA, accountB].map((uid) => adminDb.recursiveDelete(users.doc(uid))),
        ...[token, otherToken].map((value) => adminDb.collection('pushInstallations').doc(hash(value)).delete()),
        ...[firstDevice, secondDevice, switched].map((key) => adminDb.collection('pushInstallationRevocations').doc(hash(key)).delete()),
      ]);
    }
  }, 30_000);
});

it('selects generic push previews by installation language', () => {
  expect(pushPreview('en').body).toBe('You have a new notification.');
  expect(pushPreview('es').body).toBe('Tienes una notificación nueva.');
});
