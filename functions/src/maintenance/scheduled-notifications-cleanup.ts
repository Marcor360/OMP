import { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";

import { adminDb } from "../config/firebaseAdmin.js";

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

const getNotificationCutoff = (now: Date): Date => {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
};

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

const migrateLegacyRootNotificationsPage = async (): Promise<{
  scanned: number;
  migrated: number;
  skipped: number;
}> => {
  const snapshot = await adminDb
    .collection(NOTIFICATIONS_COLLECTION_ID)
    .limit(LEGACY_MIGRATION_PAGE_SIZE)
    .get();

  if (snapshot.empty) {
    return { scanned: 0, migrated: 0, skipped: 0 };
  }

  const batch = adminDb.batch();
  let migrated = 0;
  let skipped = 0;

  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const congregationId =
      typeof data.congregationId === "string" ? data.congregationId.trim() : "";
    const userId = typeof data.userId === "string" ? data.userId.trim() : "";

    if (!congregationId || !userId) {
      batch.delete(docSnap.ref);
      skipped += 1;
      return;
    }

    const scopedRef = adminDb
      .collection("congregations")
      .doc(congregationId)
      .collection(NOTIFICATIONS_COLLECTION_ID)
      .doc(docSnap.id);

    batch.set(
      scopedRef,
      {
        ...data,
        notificationId:
          typeof data.notificationId === "string" && data.notificationId.trim().length > 0
            ? data.notificationId
            : docSnap.id,
        congregationId,
        userId,
        userIds: [userId],
      },
      { merge: true }
    );
    batch.delete(docSnap.ref);
    migrated += 1;
  });

  if (migrated > 0 || skipped > 0) {
    await batch.commit();
  }

  return {
    scanned: snapshot.size,
    migrated,
    skipped,
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

    while (true) {
      const page = await migrateLegacyRootNotificationsPage();
      scanned += page.scanned;
      migrated += page.migrated;
      skipped += page.skipped;

      if (page.scanned === 0 || page.migrated === 0) {
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
