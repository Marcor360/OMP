import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { onDocumentDeleted } from 'firebase-functions/v2/firestore';

/**
 * Firestore no borra subcolecciones en cascada. Al eliminar una reunion, sus asignaciones
 * quedan huerfanas y siguen apareciendo en las consultas collectionGroup('assignments').
 * Este trigger las limpia.
 */
export const cleanupMeetingSubcollectionsOnDelete = onDocumentDeleted(
  {
    region: 'us-central1',
    document: 'congregations/{congregationId}/meetings/{meetingId}',
  },
  async (event) => {
    const { congregationId, meetingId } = event.params;
    const meetingRef = getFirestore()
      .collection('congregations')
      .doc(congregationId)
      .collection('meetings')
      .doc(meetingId);

    try {
      // Delete only children. The same meeting ID may have been recreated since the event.
      const children = await meetingRef.listCollections();
      if ((await meetingRef.get()).exists) return;
      for (const child of children) {
        if ((await meetingRef.get()).exists) return;
        await getFirestore().recursiveDelete(child);
      }
      logger.info('Subcolecciones de reunion eliminadas', { congregationId, meetingId });
    } catch (error) {
      logger.error('cleanupMeetingSubcollectionsOnDelete fallo', {
        congregationId,
        meetingId,
        error,
      });
      throw error;
    }
  }
);
