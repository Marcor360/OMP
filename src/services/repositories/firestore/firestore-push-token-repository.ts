import { bindCurrentPushInstallation, detachCurrentPushInstallation } from '@/src/services/notifications/push-installation-client';
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
      await bindCurrentPushInstallation({
        uid,
        token: payload.token,
        congregationId: payload.congregationId,
        platform: payload.platform,
        deviceName: payload.deviceName,
      });
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
    if (payload.token) await detachCurrentPushInstallation(uid, payload.token);
  },
};
