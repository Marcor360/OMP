import { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";

import { adminDb } from "../config/firebaseAdmin.js";

const NOTIFICATIONS_COLLECTION_ID = "notifications";
const CLEANUP_SCHEDULE = "0 1 1 * *";
const CLEANUP_TIME_ZONE = "America/Mexico_City";
const RETENTION_MONTHS = 6;
const QUERY_PAGE_SIZE = 400;

type NotificationCleanupSummary = {
  startedAt: string;
  finishedAt: string;
  cutoffAt: string;
  retentionMonths: number;
  scanned: number;
  deleted: number;
  errors: number;
};

const getNotificationCutoff = (now: Date): Date => {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
};

const toDateKey = (date: Date): string => date.toISOString().slice(0, 10);

const deleteSnapshot = async (
  snapshot: FirebaseFirestore.QuerySnapshot
): Promise<number> => {
  if (snapshot.empty) return 0;

  const batch = adminDb.batch();
  snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();

  return snapshot.size;
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
    const cutoffAt = getNotificationCutoff(startedAt);
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

    while (true) {
      const snapshot = await adminDb
        .collectionGroup(NOTIFICATIONS_COLLECTION_ID)
        .where("createdAt", "<", cutoffTimestamp)
        .orderBy("createdAt", "asc")
        .limit(QUERY_PAGE_SIZE)
        .get();

      if (snapshot.empty) {
        break;
      }

      scanned += snapshot.size;

      try {
        deleted += await deleteSnapshot(snapshot);
      } catch (error) {
        errors += snapshot.size;
        logger.error("[scheduledNotificationsCleanup] Error eliminando lote", {
          batchSize: snapshot.size,
          error: error instanceof Error ? error.message : String(error),
        });
        break;
      }
    }

    while (true) {
      const snapshot = await adminDb
        .collectionGroup(NOTIFICATIONS_COLLECTION_ID)
        .where("metadata.date", "<", toDateKey(cutoffAt))
        .orderBy("metadata.date", "asc")
        .limit(QUERY_PAGE_SIZE)
        .get();

      if (snapshot.empty) {
        break;
      }

      scanned += snapshot.size;

      try {
        deleted += await deleteSnapshot(snapshot);
      } catch (error) {
        errors += snapshot.size;
        logger.error(
          "[scheduledNotificationsCleanup] Error eliminando lote por fecha de asignacion",
          {
            batchSize: snapshot.size,
            error: error instanceof Error ? error.message : String(error),
          }
        );
        break;
      }
    }

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
