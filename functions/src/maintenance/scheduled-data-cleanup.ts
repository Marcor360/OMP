import { getStorage } from "firebase-admin/storage";
import {
  FieldPath,
  FieldValue,
  Timestamp,
  type DocumentReference,
  type Query,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";

import { adminDb } from "../config/firebaseAdmin.js";

const CLEANUP_SCHEDULE = "0 1 1 * *";
const CLEANUP_TIME_ZONE = "America/Mexico_City";
const RETENTION_MONTHS = 6;
const QUERY_PAGE_SIZE = 200;
const CACHE_CONTROL_DOC_PATH = "system/cacheControl";

const TARGET_COLLECTION_IDS = [
  "reuniones",
  "assignments",
  "asignaciones",
  "meetings",
  "tareas",
  "tasks",
  "archivos",
  "files",
] as const;

const DATE_FIELD_CANDIDATES = [
  "endDate",
  "meetingDate",
  "startDate",
  "dueDate",
  "date",
  "scheduledAt",
] as const;

const EXCLUDED_PATH_PARTS = [
  "informes",
  "reports",
  "field-service",
  "fieldService",
  "monthlyReports",
] as const;

type TargetCollectionId = (typeof TARGET_COLLECTION_IDS)[number];

type CollectionCleanupStats = {
  collectionId: TargetCollectionId;
  scanned: number;
  deletedDocs: number;
  deletedFiles: number;
  deletedNotifications: number;
  skippedFileDelete: number;
  fileDeleteErrors: number;
  docDeleteErrors: number;
};

type InactiveUsersCleanupStats = {
  scanned: number;
  deletedUsers: number;
  skippedRecent: number;
  skippedMissingDate: number;
  deleteErrors: number;
};

type CleanupRunSummary = {
  startedAt: string;
  finishedAt: string;
  cutoffAt: string;
  schedule: string;
  timeZone: string;
  totals: {
    scanned: number;
    deletedDocs: number;
    deletedFiles: number;
    deletedNotifications: number;
    skippedFileDelete: number;
    fileDeleteErrors: number;
    docDeleteErrors: number;
    deletedInactiveUsers: number;
    inactiveUserDeleteErrors: number;
  };
  byCollection: CollectionCleanupStats[];
  inactiveUsers: InactiveUsersCleanupStats;
};

const normalizeStoragePath = (
  rawFilePath: string,
  defaultBucketName: string
): {bucketName: string; objectPath: string} | null => {
  const filePath = rawFilePath.trim();
  if (filePath.length === 0) return null;

  if (filePath.startsWith("gs://")) {
    const match = filePath.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (!match) return null;
    return {
      bucketName: match[1],
      objectPath: match[2],
    };
  }

  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    try {
      const parsedUrl = new URL(filePath);
      const bucketMatch = parsedUrl.pathname.match(/\/b\/([^/]+)\/o\/(.+)$/);
      if (!bucketMatch) return null;

      return {
        bucketName: bucketMatch[1],
        objectPath: decodeURIComponent(bucketMatch[2]),
      };
    } catch {
      return null;
    }
  }

  return {
    bucketName: defaultBucketName,
    objectPath: filePath.replace(/^\/+/, ""),
  };
};

const getCleanupCutoff = (now: Date): Date => {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
};

const deleteStorageFileIfPresent = async (params: {
  rawFilePath: unknown;
  defaultBucketName: string;
  docPath: string;
  stats: CollectionCleanupStats;
}): Promise<void> => {
  if (typeof params.rawFilePath !== "string" || params.rawFilePath.trim().length === 0) {
    params.stats.skippedFileDelete += 1;
    return;
  }

  const normalized = normalizeStoragePath(
    params.rawFilePath,
    params.defaultBucketName
  );

  if (!normalized || normalized.objectPath.length === 0) {
    params.stats.fileDeleteErrors += 1;
    logger.warn("[scheduledDataCleanup] filePath invalido", {
      docPath: params.docPath,
      filePath: params.rawFilePath,
    });
    return;
  }

  try {
    await getStorage()
      .bucket(normalized.bucketName)
      .file(normalized.objectPath)
      .delete({ignoreNotFound: true});
    params.stats.deletedFiles += 1;
  } catch (error) {
    params.stats.fileDeleteErrors += 1;
    logger.error("[scheduledDataCleanup] Error eliminando archivo", {
      docPath: params.docPath,
      filePath: params.rawFilePath,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const toMillis = (value: unknown): number | null => {
  if (!value) return null;

  if (value instanceof Timestamp) {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }

  if (typeof value === "object" && value !== null && "toDate" in value) {
    const maybeTimestamp = value as {toDate?: unknown};
    if (typeof maybeTimestamp.toDate === "function") {
      const date = maybeTimestamp.toDate() as Date;
      return Number.isNaN(date.getTime()) ? null : date.getTime();
    }
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const getEffectiveExpirationMillis = (data: Record<string, unknown>): number | null => {
  const orderedFields = [
    "endDate",
    "meetingDate",
    "startDate",
    "dueDate",
    "date",
    "scheduledAt",
  ] as const;

  for (const field of orderedFields) {
    const millis = toMillis(data[field]);
    if (millis !== null) {
      return millis;
    }
  }

  return null;
};

const getInactiveUserExpirationMillis = (data: Record<string, unknown>): number | null => {
  const orderedFields = [
    "disabledAt",
    "deactivatedAt",
    "updatedAt",
    "createdAt",
  ] as const;

  for (const field of orderedFields) {
    const millis = toMillis(data[field]);
    if (millis !== null) {
      return millis;
    }
  }

  return null;
};

const extractMeetingContext = (
  docPath: string
): {congregationId: string; meetingId: string} | null => {
  const match = docPath.match(/^congregations\/([^/]+)\/meetings\/([^/]+)$/);
  if (!match) return null;

  return {
    congregationId: match[1],
    meetingId: match[2],
  };
};

const deleteQueryInBatches = async (queryRef: Query): Promise<number> => {
  let deleted = 0;

  while (true) {
    const snapshot = await queryRef.limit(QUERY_PAGE_SIZE).get();

    if (snapshot.empty) {
      return deleted;
    }

    const batch = adminDb.batch();
    snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    deleted += snapshot.size;
  }
};

const collectSubcollectionDocIds = async (
  parentRef: DocumentReference,
  collectionId: string
): Promise<string[]> => {
  const ids: string[] = [];
  let cursor: QueryDocumentSnapshot | null = null;

  while (true) {
    let queryRef = parentRef.collection(collectionId).limit(QUERY_PAGE_SIZE);

    if (cursor) {
      queryRef = queryRef.startAfter(cursor);
    }

    const snapshot = await queryRef.get();

    if (snapshot.empty) {
      return ids;
    }

    snapshot.docs.forEach((docSnap) => ids.push(docSnap.id));
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }
};

const deleteNotificationsByAssignmentIds = async (params: {
  congregationId: string;
  assignmentIds: string[];
  stats: CollectionCleanupStats;
}): Promise<void> => {
  const uniqueAssignmentIds = Array.from(new Set(params.assignmentIds));

  for (const assignmentId of uniqueAssignmentIds) {
    try {
      let deleted = 0;

      while (true) {
        const snapshot = await adminDb
          .collectionGroup("notifications")
          .where("assignmentId", "==", assignmentId)
          .limit(QUERY_PAGE_SIZE)
          .get();

        if (snapshot.empty) {
          break;
        }

        const batch = adminDb.batch();
        let batchDeletes = 0;

        snapshot.docs.forEach((notificationDoc) => {
          const data = notificationDoc.data() as Record<string, unknown>;
          if (data.congregationId !== params.congregationId) return;

          batch.delete(notificationDoc.ref);
          batchDeletes += 1;
        });

        if (batchDeletes === 0) {
          break;
        }

        await batch.commit();
        deleted += batchDeletes;
      }

      params.stats.deletedNotifications += deleted;
    } catch (error) {
      params.stats.docDeleteErrors += 1;
      logger.error(
        "[scheduledDataCleanup] Error eliminando notificaciones por asignacion",
        {
          congregationId: params.congregationId,
          assignmentId,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }
};

const deleteRelatedNotificationsForMeeting = async (params: {
  congregationId: string;
  meetingId: string;
  assignmentIds: string[];
  stats: CollectionCleanupStats;
}): Promise<void> => {
  try {
    const deletedByMetadata = await deleteQueryInBatches(
      adminDb
        .collectionGroup("notifications")
        .where("metadata.meetingId", "==", params.meetingId)
    );
    const assignmentPrefix = `${params.meetingId}:`;
    const deletedByAssignmentId = await deleteQueryInBatches(
      adminDb
        .collectionGroup("notifications")
        .where("assignmentId", ">=", assignmentPrefix)
        .where("assignmentId", "<", `${assignmentPrefix}\uf8ff`)
        .orderBy("assignmentId", "asc")
    );

    params.stats.deletedNotifications += deletedByMetadata + deletedByAssignmentId;
  } catch (error) {
    params.stats.docDeleteErrors += 1;
    logger.error("[scheduledDataCleanup] Error eliminando notificaciones de reunion", {
      meetingId: params.meetingId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  await deleteNotificationsByAssignmentIds({
    congregationId: params.congregationId,
    assignmentIds: params.assignmentIds,
    stats: params.stats,
  });
};

const cleanupCollectionGroup = async (params: {
  collectionId: TargetCollectionId;
  cutoffTimestamp: Timestamp;
  defaultBucketName: string;
}): Promise<CollectionCleanupStats> => {
  const stats: CollectionCleanupStats = {
    collectionId: params.collectionId,
    scanned: 0,
    deletedDocs: 0,
    deletedFiles: 0,
    deletedNotifications: 0,
    skippedFileDelete: 0,
    fileDeleteErrors: 0,
    docDeleteErrors: 0,
  };

  logger.info("[scheduledDataCleanup] Iniciando limpieza de coleccion", {
    collectionId: params.collectionId,
    cutoffTimestamp: params.cutoffTimestamp.toDate().toISOString(),
  });

  const processedPaths = new Set<string>();

  for (const dateField of DATE_FIELD_CANDIDATES) {
    let cursor: QueryDocumentSnapshot | null = null;

    while (true) {
      let queryRef = adminDb
        .collectionGroup(params.collectionId)
        .where(dateField, "<", params.cutoffTimestamp)
        .orderBy(dateField, "asc")
        .limit(QUERY_PAGE_SIZE);

      if (cursor) {
        queryRef = queryRef.startAfter(cursor);
      }

      const snapshot = await queryRef.get();

      if (snapshot.empty) {
        break;
      }

      stats.scanned += snapshot.size;

      for (const docSnap of snapshot.docs) {
        if (processedPaths.has(docSnap.ref.path)) {
          continue;
        }

        processedPaths.add(docSnap.ref.path);

        if (EXCLUDED_PATH_PARTS.some((part) => docSnap.ref.path.includes(part))) {
          logger.info("[scheduledDataCleanup] Documento omitido por politica de informes", {
            docPath: docSnap.ref.path,
            collectionId: params.collectionId,
          });
          continue;
        }

        const data = docSnap.data() as Record<string, unknown>;
        const effectiveExpirationMillis = getEffectiveExpirationMillis(data);

        if (
          effectiveExpirationMillis === null ||
          effectiveExpirationMillis >= params.cutoffTimestamp.toMillis()
        ) {
          continue;
        }

        await deleteStorageFileIfPresent({
          rawFilePath: data.filePath,
          defaultBucketName: params.defaultBucketName,
          docPath: docSnap.ref.path,
          stats,
        });

        try {
          const meetingContext = params.collectionId === "meetings" ?
            extractMeetingContext(docSnap.ref.path) :
            null;

          if (meetingContext) {
            const assignmentIds = await collectSubcollectionDocIds(
              docSnap.ref,
              "assignments"
            );

            await deleteRelatedNotificationsForMeeting({
              congregationId: meetingContext.congregationId,
              meetingId: meetingContext.meetingId,
              assignmentIds,
              stats,
            });
            await adminDb.recursiveDelete(docSnap.ref);
          } else {
            await docSnap.ref.delete();
          }

          stats.deletedDocs += 1;
        } catch (error) {
          stats.docDeleteErrors += 1;
          logger.error("[scheduledDataCleanup] Error eliminando documento", {
            docPath: docSnap.ref.path,
            collectionId: params.collectionId,
            dateField,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      cursor = snapshot.docs[snapshot.docs.length - 1];
    }
  }

  logger.info("[scheduledDataCleanup] Coleccion procesada", stats);

  return stats;
};

const cleanupInactiveUsers = async (params: {
  cutoffTimestamp: Timestamp;
}): Promise<InactiveUsersCleanupStats> => {
  const stats: InactiveUsersCleanupStats = {
    scanned: 0,
    deletedUsers: 0,
    skippedRecent: 0,
    skippedMissingDate: 0,
    deleteErrors: 0,
  };
  let cursor: QueryDocumentSnapshot | null = null;

  logger.info("[scheduledDataCleanup] Iniciando limpieza de usuarios desactivados", {
    cutoffTimestamp: params.cutoffTimestamp.toDate().toISOString(),
  });

  while (true) {
    let queryRef = adminDb
      .collection("users")
      .where("isActive", "==", false)
      .orderBy(FieldPath.documentId())
      .limit(QUERY_PAGE_SIZE);

    if (cursor) {
      queryRef = queryRef.startAfter(cursor);
    }

    const snapshot = await queryRef.get();

    if (snapshot.empty) {
      break;
    }

    stats.scanned += snapshot.size;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as Record<string, unknown>;
      const expirationMillis = getInactiveUserExpirationMillis(data);

      if (expirationMillis === null) {
        stats.skippedMissingDate += 1;
        continue;
      }

      if (expirationMillis >= params.cutoffTimestamp.toMillis()) {
        stats.skippedRecent += 1;
        continue;
      }

      try {
        await docSnap.ref.delete();
        stats.deletedUsers += 1;
      } catch (error) {
        stats.deleteErrors += 1;
        logger.error("[scheduledDataCleanup] Error eliminando usuario desactivado", {
          uid: docSnap.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    cursor = snapshot.docs[snapshot.docs.length - 1];
  }

  logger.info("[scheduledDataCleanup] Usuarios desactivados procesados", stats);
  return stats;
};

const buildRunSummary = (params: {
  startedAt: Date;
  finishedAt: Date;
  cutoffAt: Date;
  statsByCollection: CollectionCleanupStats[];
  inactiveUsersStats: InactiveUsersCleanupStats;
}): CleanupRunSummary => {
  const totals = params.statsByCollection.reduce(
    (acc, current) => {
      acc.scanned += current.scanned;
      acc.deletedDocs += current.deletedDocs;
      acc.deletedFiles += current.deletedFiles;
      acc.deletedNotifications += current.deletedNotifications;
      acc.skippedFileDelete += current.skippedFileDelete;
      acc.fileDeleteErrors += current.fileDeleteErrors;
      acc.docDeleteErrors += current.docDeleteErrors;
      return acc;
    },
    {
      scanned: 0,
      deletedDocs: 0,
      deletedFiles: 0,
      deletedNotifications: 0,
      skippedFileDelete: 0,
      fileDeleteErrors: 0,
      docDeleteErrors: 0,
      deletedInactiveUsers: params.inactiveUsersStats.deletedUsers,
      inactiveUserDeleteErrors: params.inactiveUsersStats.deleteErrors,
    }
  );

  return {
    startedAt: params.startedAt.toISOString(),
    finishedAt: params.finishedAt.toISOString(),
    cutoffAt: params.cutoffAt.toISOString(),
    schedule: CLEANUP_SCHEDULE,
    timeZone: CLEANUP_TIME_ZONE,
    totals,
    byCollection: params.statsByCollection,
    inactiveUsers: params.inactiveUsersStats,
  };
};

const updateCacheControlDocument = async (summary: CleanupRunSummary): Promise<void> => {
  const cacheControlRef = adminDb.doc(CACHE_CONTROL_DOC_PATH);

  await cacheControlRef.set(
    {
      cacheVersion: FieldValue.increment(1),
      lastCleanupRequestAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      requestedBy: "scheduledDataCleanup",
      cleanupPolicy: {
        retention: "six-months",
        retentionMonths: RETENTION_MONTHS,
        dateFields: DATE_FIELD_CANDIDATES,
        excludedPathParts: EXCLUDED_PATH_PARTS,
        preservedCollections: ["users activos", "roles", "configuraciones"],
        inactiveUsersDeletedAfterMonths: RETENTION_MONTHS,
        schedule: CLEANUP_SCHEDULE,
        timeZone: CLEANUP_TIME_ZONE,
      },
      lastRunSummary: summary,
    },
    {merge: true}
  );
};

export const scheduledDataCleanup = onSchedule(
  {
    schedule: CLEANUP_SCHEDULE,
    timeZone: CLEANUP_TIME_ZONE,
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async () => {
    const startedAt = new Date();
    const cutoffAt = getCleanupCutoff(startedAt);
    const cutoffTimestamp = Timestamp.fromDate(cutoffAt);
    const defaultBucketName = getStorage().bucket().name;

    logger.info("[scheduledDataCleanup] Inicio de ejecucion", {
      startedAt: startedAt.toISOString(),
      cutoffAt: cutoffAt.toISOString(),
      defaultBucketName,
      targetCollections: TARGET_COLLECTION_IDS,
    });

    const statsByCollection: CollectionCleanupStats[] = [];

    for (const collectionId of TARGET_COLLECTION_IDS) {
      try {
        const stats = await cleanupCollectionGroup({
          collectionId,
          cutoffTimestamp,
          defaultBucketName,
        });
        statsByCollection.push(stats);
      } catch (error) {
        logger.error("[scheduledDataCleanup] Error en coleccion", {
          collectionId,
          error: error instanceof Error ? error.message : String(error),
        });

        statsByCollection.push({
          collectionId,
          scanned: 0,
          deletedDocs: 0,
          deletedFiles: 0,
          deletedNotifications: 0,
          skippedFileDelete: 0,
          fileDeleteErrors: 0,
          docDeleteErrors: 1,
        });
      }
    }

    let inactiveUsersStats: InactiveUsersCleanupStats = {
      scanned: 0,
      deletedUsers: 0,
      skippedRecent: 0,
      skippedMissingDate: 0,
      deleteErrors: 0,
    };

    try {
      inactiveUsersStats = await cleanupInactiveUsers({
        cutoffTimestamp,
      });
    } catch (error) {
      inactiveUsersStats.deleteErrors += 1;
      logger.error("[scheduledDataCleanup] Error en limpieza de usuarios desactivados", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const finishedAt = new Date();
    const summary = buildRunSummary({
      startedAt,
      finishedAt,
      cutoffAt,
      statsByCollection,
      inactiveUsersStats,
    });

    try {
      await updateCacheControlDocument(summary);
    } catch (error) {
      logger.error(
        "[scheduledDataCleanup] Error actualizando system/cacheControl",
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }

    logger.info("[scheduledDataCleanup] Ejecucion finalizada", summary);
  }
);
