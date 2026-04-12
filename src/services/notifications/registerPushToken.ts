import { arrayUnion, serverTimestamp, setDoc } from 'firebase/firestore';

import { getNativePushToken } from '@/src/firebase/messaging';
import { userDocRef } from '@/src/lib/firebase/refs';

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

  await setDoc(
    userDocRef(userId),
    {
      uid: userId,
      notificationTokens: arrayUnion(token),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};
