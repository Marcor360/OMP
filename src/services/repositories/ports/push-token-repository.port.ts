export type PushTokenProfilePayload = {
  kind: 'userProfile';
  token: string;
  includePushTokenUpdatedAt: boolean;
};

export type PushTokenDocumentPayload = {
  kind: 'tokenDocument';
  tokenDocId: string;
  token: string;
  userId: string;
  congregationId: string;
  platform: string;
  deviceName: string | null;
  isActive: boolean;
};

export type SavePushTokenPayload = PushTokenProfilePayload | PushTokenDocumentPayload;

export type RemovePushTokenPayload = {
  token: string | null;
};

export interface PushTokenRepository {
  savePushToken(uid: string, payload: SavePushTokenPayload): Promise<void>;
  removePushToken(uid: string, payload: RemovePushTokenPayload): Promise<void>;
}
