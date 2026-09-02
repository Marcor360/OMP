import { serverTimestamp, setDoc } from 'firebase/firestore';

import { userPushTokenDocRef } from '@/src/lib/firebase/refs';
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

    // Los tokens push canónicos viven únicamente en /users/{uid}/pushTokens.
    // No persistir tokens nativos o arrays legacy en el perfil del usuario.
    void uid;
    void payload;
  },

  removePushToken: async (
    uid: string,
    payload: { token: string | null }
  ): Promise<void> => {
    void uid;
    void payload;
  },
};
