import { getNativePushToken } from '@/src/firebase/messaging';
import { firestorePushTokenRepository } from '@/src/services/repositories/firestore/firestore-push-token-repository';
import type { PushTokenRepository } from '@/src/services/repositories/ports/push-token-repository.port';

let pushTokenRepository: PushTokenRepository = firestorePushTokenRepository;

export const __setPushTokenRepositoryForTests = (
  repo: PushTokenRepository
): void => {
  pushTokenRepository = repo;
};

export const __resetPushTokenRepositoryForTests = (): void => {
  pushTokenRepository = firestorePushTokenRepository;
};

export const registerPushTokenForCurrentUser = async (
  userId: string
): Promise<void> => {
  if (!userId || userId.trim().length === 0) {
    return;
  }

  const token = await getNativePushToken();

  if (!token) {
    return;
  }

  await pushTokenRepository.savePushToken(userId, {
    kind: 'userProfile',
    token,
    includePushTokenUpdatedAt: false,
  });
};
