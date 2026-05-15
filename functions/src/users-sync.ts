import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { region as regionV1 } from 'firebase-functions/v1';
import { logger } from 'firebase-functions/v2';
import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { isSystemPrincipalUser } from './user-protection.js';

const isAuthUserNotFound = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const code = 'code' in error ? String(error.code) : '';
  return code === "auth/user-not-found";
};

export const deleteUserProfileOnAuthDelete = regionV1('us-central1')
  .auth.user()
  .onDelete(async (user) => {
    const uid = user.uid;
    if (!uid) return;

    try {
      const profileRef = getFirestore().collection('users').doc(uid);
      const profileSnap = await profileRef.get();

      if (
        profileSnap.exists &&
        isSystemPrincipalUser(profileSnap.data() as Record<string, unknown>)
      ) {
        logger.warn('Protected system principal auth user was deleted; preserving profile.', { uid });
        return;
      }

      await profileRef.delete();
    } catch (error) {
      logger.error('deleteUserProfileOnAuthDelete failed', { uid, error });
      throw error;
    }
  });

export const deleteAuthUserOnProfileDelete = onDocumentDeleted(
  { region: 'us-central1', document: 'users/{uid}' },
  async (event) => {
    const uid = event.params.uid;
    const deletedProfile = event.data?.data() as Record<string, unknown> | undefined;

    try {
      if (deletedProfile && isSystemPrincipalUser(deletedProfile)) {
        logger.warn('Protected system principal profile deletion detected; restoring profile.', { uid });
        await getFirestore().collection('users').doc(uid).set({
          ...deletedProfile,
          restoredAfterProtectedDeleteAt: new Date().toISOString(),
        });
        return;
      }

      await getAuth().deleteUser(uid);
    } catch (error) {
      if (isAuthUserNotFound(error)) {
        return;
      }

      logger.error('deleteAuthUserOnProfileDelete failed', { uid, error });
      throw error;
    }
  }
);
