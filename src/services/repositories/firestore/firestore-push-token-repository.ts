import {
  arrayRemove,
  arrayUnion,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

import {
  userDocRef,
  userPushTokenDocRef,
} from '@/src/lib/firebase/refs';
import type {
  PushTokenDocumentPayload,
  PushTokenRepository,
  SavePushTokenPayload,
} from '@/src/services/repositories/ports/push-token-repository.port';

const isPushTokenDocumentPayload = (
  payload: SavePushTokenPayload
): payload is PushTokenDocumentPayload =>
  payload.kind === 'tokenDocument';

export const firestorePushTokenRepository: PushTokenRepository = {
  savePushToken: async (
    uid: string,
    payload: SavePushTokenPayload
  ): Promise<void> => {
    if (isPushTokenDocumentPayload(payload)) {
      await setDoc(
        userPushTokenDocRef(uid, payload.tokenDocId),
        {
          token: payload.token,
          userId: payload.userId,
          congregationId: payload.congregationId,
          platform: payload.platform,
          deviceName: payload.deviceName,
          isActive: payload.isActive,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }

    await setDoc(
      userDocRef(uid),
      {
        uid,
        notificationTokens: arrayUnion(payload.token),
        ...(payload.includePushTokenUpdatedAt
          ? { pushTokenUpdatedAt: serverTimestamp() }
          : {}),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  },

  removePushToken: async (
    uid: string,
    payload: { token: string | null }
  ): Promise<void> => {
    await setDoc(
      userDocRef(uid),
      {
        ...(payload.token ? { notificationTokens: arrayRemove(payload.token) } : {}),
        pushTokenUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  },
};
