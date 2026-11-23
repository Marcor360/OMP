import { Timestamp, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";

import { adminDb } from "../config/firebaseAdmin.js";
import { deleteNotificationPage } from "./delete-notification-page.js";
import { canSweepPath, retentionCutoff } from "./retention-policy.js";

const NOTIFICATIONS_COLLECTION_ID = "notifications";
const CLEANUP_SCHEDULE = "0 1 1 * *";
const CLEANUP_TIME_ZONE = "America/Mexico_City";
const RETENTION_MONTHS = 6;
const QUERY_PAGE_SIZE = 400;
const LEGACY_MIGRATION_PAGE_SIZE = 300;

type NotificationCleanupSummary = {
  startedAt: string;
  finishedAt: string;
  cutoffAt: string;
  retentionMonths: number;
  scanned: number;
  deleted: number;
  errors: number;
};

export const scheduledNotificationsCleanup = onSchedule(
  {
    schedule: CLEANUP_SCHEDULE,
    timeZone: CLEANUP_TIME_ZONE,
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const startedAt = new Date();
    const cutoffAt = retentionCutoff(startedAt, RETENTION_MONTHS);
    const cutoffTimestamp = Timestamp.fromDate(cutoffAt);
    let scanned = 0;
    let deleted = 0;
    let errors = 0;

    logger.info("[scheduledNotificationsCleanup] Inicio de ejecucion", {
      startedAt: startedAt.toISOString(),
      cutoffAt: cutoffAt.toISOString(),
      retentionMonths: RETENTION_MONTHS,
      collectionId: NOTIFICATIONS_COLLECTION_ID,
    });

    let cursor: QueryDocumentSnapshot | undefined;
    while (true) {
      const query = adminDb
        .collectionGroup(NOTIFICATIONS_COLLECTION_ID)
        .where("createdAt", "<", cutoffTimestamp)
        .orderBy("createdAt", "asc")
        .limit(QUERY_PAGE_SIZE);
      const snapshot = await (cursor ? query.startAfter(cursor) : query).get();

      if (snapshot.empty) {
        break;
      }

      scanned += snapshot.size;
      cursor = snapshot.docs[snapshot.docs.length - 1];

      try {
        const result = await deleteNotificationPage(snapshot.docs.filter((doc) => canSweepPath(doc.ref.path, NOTIFICATIONS_COLLECTION_ID)));
        deleted += result.deleted;
        errors += result.errors;
      } catch (error) {
        errors += snapshot.size;
        logger.error("[scheduledNotificationsCleanup] Error eliminando lote", {
          batchSize: snapshot.size,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Datos legacy con metadata.date localizada se eliminan progresivamente por
    // createdAt. Las nuevas notificaciones guardan metadata.meetingDate Timestamp.

    const finishedAt = new Date();
    const summary: NotificationCleanupSummary = {
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      cutoffAt: cutoffAt.toISOString(),
      retentionMonths: RETENTION_MONTHS,
      scanned,
      deleted,
      errors,
    };

    logger.info("[scheduledNotificationsCleanup] Ejecucion finalizada", summary);
  }
);

export const migrateLegacyRootNotificationsPage = async (cursor?: QueryDocumentSnapshot): Promise<{
  scanned: number;
  migrated: number;
  skipped: number;
  cursor?: QueryDocumentSnapshot;
}> => {
  const query = adminDb
    .collection(NOTIFICATIONS_COLLECTION_ID)
    .limit(LEGACY_MIGRATION_PAGE_SIZE);
  const snapshot = await (cursor ? query.startAfter(cursor) : query).get();

  if (snapshot.empty) {
    return { scanned: 0, migrated: 0, skipped: 0 };
  }

  let migrated = 0;
  let skipped = 0;
  for (let offset = 0; offset < snapshot.size; offset += 8) {
    const results = await Promise.allSettled(snapshot.docs.slice(offset, offset + 8).map(async (docSnap) => {
      const data = docSnap.data();
      const congregationId = typeof data.congregationId === 'string' ? data.congregationId.trim() : '';
      const userId = typeof data.userId === 'string' ? data.userId.trim() : '';
      if (!congregationId || !userId || congregationId.includes('/') || userId.includes('/')) return false;

      const destination = adminDb.collection('congregations').doc(congregationId)
        .collection(NOTIFICATIONS_COLLECTION_ID).doc(docSnap.id);
      return adminDb.runTransaction(async (transaction) => {
        const [source, existing] = await transaction.getAll(docSnap.ref, destination);
        if (!source.updateTime?.isEqual(docSnap.updateTime) || existing.exists) return false;

        transaction.create(destination, {
          ...data,
          notificationId: typeof data.notificationId === 'string' && data.notificationId.trim()
            ? data.notificationId : docSnap.id,
          congregationId, userId, userIds: [userId],
        });
        transaction.delete(docSnap.ref);
        return true;
      });
    }));
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) migrated += 1;
      else skipped += 1;
    }
  }

  return {
    scanned: snapshot.size,
    migrated,
    skipped,
    cursor: snapshot.docs[snapshot.docs.length - 1],
  };
};

export const scheduledLegacyRootNotificationsMigration = onSchedule(
  {
    schedule: "every 24 hours",
    timeZone: CLEANUP_TIME_ZONE,
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "512MiB",
    maxInstances: 1,
  },
  async () => {
    let scanned = 0;
    let migrated = 0;
    let skipped = 0;

    let cursor: QueryDocumentSnapshot | undefined;
    while (true) {
      const page = await migrateLegacyRootNotificationsPage(cursor);
      scanned += page.scanned;
      migrated += page.migrated;
      skipped += page.skipped;

      cursor = page.cursor;
      if (!cursor || page.scanned < LEGACY_MIGRATION_PAGE_SIZE) {
        break;
      }
    }

    logger.info("[scheduledLegacyRootNotificationsMigration] Finalizada", {
      scanned,
      migrated,
      skipped,
    });
  }
);
