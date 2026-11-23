import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

import { adminDb } from '../../config/firebaseAdmin.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const validKey = (key: unknown): key is string =>
  typeof key === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(key);
const validToken = (token: unknown): token is string =>
  typeof token === 'string' && token.length <= 200 && (
    /^(?:Exponent|Expo)PushToken\[[\w-]+\]$/.test(token) || /^[\da-z]{8}(?:-[\da-z]{4}){3}-[\da-z]{12}$/i.test(token)
  );
const tokenDocId = (token: string) => encodeURIComponent(token).replace(/\./g, '%2E');
const tokenRef = (uid: string, token: string) =>
  adminDb.collection('users').doc(uid).collection('pushTokens').doc(tokenDocId(token));

const parseCredentials = (raw: { token?: unknown; key?: unknown } | undefined) => {
  if (
    !validToken(raw?.token) ||
    !validKey(raw.key)
  ) throw new HttpsError('invalid-argument', 'Registro de notificaciones inválido.');
  return { token: raw.token, keyHash: hash(raw.key) };
};

export const bindPushInstallation = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid || uid !== request.data?.uid) throw new HttpsError('permission-denied', 'La cuenta activa cambió.');
  const { token, keyHash } = parseCredentials(request.data);
  const { congregationId, platform, deviceName, previousKey, issuedAt, locale } = request.data;
  if (typeof congregationId !== 'string' || !['ios', 'android'].includes(platform) || !Number.isFinite(issuedAt)) {
    throw new HttpsError('invalid-argument', 'Registro de notificaciones inválido.');
  }
  const installation = adminDb.collection('pushInstallations').doc(hash(token));
  const revoked = adminDb.collection('pushInstallationRevocations');
  const user = adminDb.collection('users').doc(uid);
  await adminDb.runTransaction(async (transaction) => {
    const [profile, existing, revocation] = await Promise.all([
      transaction.get(user), transaction.get(installation), transaction.get(revoked.doc(keyHash)),
    ]);
    if (revocation.exists || Math.abs(Date.now() - issuedAt) > 60_000) {
      throw new HttpsError('failed-precondition', 'El registro de notificaciones venció.');
    }
    if (profile.get('isActive') !== true || profile.get('congregationId') !== congregationId) {
      throw new HttpsError('permission-denied', 'La cuenta no puede activar notificaciones.');
    }
    const previousUid = existing.get('uid');
    const previousHash = existing.get('keyHash');
    if (typeof previousUid === 'string' && previousUid !== uid) {
      if (!validKey(previousKey) || hash(previousKey) !== previousHash) {
        throw new HttpsError('permission-denied', 'La instalación pertenece a otra sesión.');
      }
      transaction.delete(tokenRef(previousUid, token));
    }
    if (typeof previousHash === 'string' && previousHash !== keyHash) {
      transaction.set(revoked.doc(previousHash), { revokedAt: FieldValue.serverTimestamp() });
    }
    transaction.set(installation, { uid, keyHash });
    transaction.set(tokenRef(uid, token), {
      token,
      userId: uid,
      congregationId,
      platform,
      deviceName: typeof deviceName === 'string' ? deviceName.slice(0, 100) : null,
      isActive: true,
      serverManaged: true,
      ...(locale === 'es' || locale === 'en' ? { locale } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { ok: true };
});

// A device can revoke its own binding after local sign-out. The random key
// authorizes only deletion of the matching binding and cannot read its owner.
export const revokePushInstallation = onCall({ region: 'us-central1' }, async (request) => {
  const { token, keyHash } = parseCredentials(request.data);
  const installation = adminDb.collection('pushInstallations').doc(hash(token));
  const revocation = adminDb.collection('pushInstallationRevocations').doc(keyHash);
  const revoked = await adminDb.runTransaction(async (transaction) => {
    const [existing, marker] = await Promise.all([transaction.get(installation), transaction.get(revocation)]);
    if (marker.exists) return true;
    const uid = existing.get('uid');
    if (typeof uid === 'string' && existing.get('keyHash') === keyHash) {
      transaction.delete(tokenRef(uid, token));
      transaction.delete(installation);
      transaction.set(revocation, { revokedAt: FieldValue.serverTimestamp() });
      return true;
    }
    return false;
  });
  return { revoked };
});
