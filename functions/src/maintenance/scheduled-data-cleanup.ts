import { getStorage } from "firebase-admin/storage";
import { getApp } from "firebase-admin/app";
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
import { deleteNotificationPage } from "./delete-notification-page.js";
import { canSweepInactiveProfile, canSweepPath, latestCleanupDate, normalizeStoragePath, retentionCutoff } from "./retention-policy.js";

const CLEANUP_SCHEDULE = "0 1 1 * *";
const CLEANUP_TIME_ZONE = "America/Mexico_City";
const RETENTION_MONTHS = 6;
const QUERY_PAGE_SIZE = 200;
const CACHE_CONTROL_DOC_PATH = "system/cacheControl";

export const CLEANUP_SCHEMA = {
  reuniones: ["endDate"],
  assignments: ["dueDate"],
  asignaciones: ["dueDate"],
  meetings: ["meetingDate", "endDate", "startDate"],
  tareas: ["dueDate"],
  tasks: ["dueDate"],
  archivos: ["endDate"],
  files: ["endDate"],
} as const;

type TargetCollectionId = keyof typeof CLEANUP_SCHEMA;

const TARGET_COLLECTION_IDS = Object.keys(CLEANUP_SCHEMA) as TargetCollectionId[];

type FieldCleanupStats = {
  field: string;
  scanned: number;
  deletedDocs: number;
  deletedFiles: number;
  deletedNotifications: number;
  errors: number;
  missingIndexes: number;
  durationMs: number;
};

type CollectionCleanupStats = {
  collectionId: TargetCollectionId;
  scanned: number;
  deletedDocs: number;
  deletedFiles: number;
  deletedNotifications: number;
  skippedFileDelete: number;
  fileDeleteErrors: number;
  docDeleteErrors: number;
  missingIndexes: number;
  durationMs: number;
  byField: FieldCleanupStats[];
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
    missingIndexes: number;
    durationMs: number;
    deletedInactiveUsers: number;
    inactiveUserDeleteErrors: number;
  };
  byCollection: CollectionCleanupStats[];
  inactiveUsers: InactiveUsersCleanupStats;
};

const deleteStorageFileIfPresent = async (params: {
  rawFilePath: unknown;
  defaultBucketName: string;
  docPath: string;
  stats: CollectionCleanupStats;
}): Promise<boolean> => {
  if (typeof params.rawFilePath !== "string" || params.rawFilePath.trim().length === 0) {
    params.stats.skippedFileDelete += 1;
    return true;
  }

  const normalized = normalizeStoragePath(
    params.rawFilePath,
    params.defaultBucketName
  );

  const scope = /^congregations\/([^/]+)\//.exec(params.docPath)?.[1];
  if (!params.defaultBucketName || !normalized || normalized.bucketName !== params.defaultBucketName ||
    !scope || !normalized.objectPath.startsWith(`congregations/${scope}/`)) {
    params.stats.fileDeleteErrors += 1;
    logger.warn("[scheduledDataCleanup] filePath invalido", {
      docPath: params.docPath,
    });
    return false;
  }

  try {
    await getStorage()
      .bucket(normalized.bucketName)
      .file(normalized.objectPath)
      .delete({ignoreNotFound: true});
    params.stats.deletedFiles += 1;
    return true;
  } catch (error) {
    params.stats.fileDeleteErrors += 1;
    logger.error("[scheduledDataCleanup] Error eliminando archivo", {
      docPath: params.docPath,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
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

const getInactiveUserExpirationMillis = (data: Record<string, unknown>): number | null =>
  latestCleanupDate(data, ['disabledAt', 'deactivatedAt'], toMillis);

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

const deleteQueryInBatches = async (
  queryRef: Query, matches: (doc: QueryDocumentSnapshot) => boolean = () => true,
): Promise<number> => {
  let deleted = 0;
  let cursor: QueryDocumentSnapshot | undefined;
  while (true) {
    const page = queryRef.limit(QUERY_PAGE_SIZE);
    const snapshot = await (cursor ? page.startAfter(cursor) : page).get();
    if (snapshot.empty) return deleted;
    cursor = snapshot.docs[snapshot.docs.length - 1];
    const result = await deleteNotificationPage(snapshot.docs.filter(matches));
    deleted += result.deleted;
    if (result.errors) logger.warn('[scheduledDataCleanup] Algunos avisos relacionados quedaron pendientes', { errors: result.errors });
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
      const query = adminDb.collection("congregations").doc(params.congregationId)
        .collection("notifications").where("assignmentId", "==", assignmentId);
      params.stats.deletedNotifications += await deleteQueryInBatches(
        query, (doc) => doc.get('congregationId') === params.congregationId,
      );
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
        .collection("congregations")
        .doc(params.congregationId)
        .collection("notifications")
        .where("metadata.meetingId", "==", params.meetingId)
    );
    const assignmentPrefix = `${params.meetingId}:`;
    const deletedByAssignmentId = await deleteQueryInBatches(
      adminDb
        .collection("congregations")
        .doc(params.congregationId)
        .collection("notifications")
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
  const collectionStartedAt = Date.now();
  const stats: CollectionCleanupStats = {
    collectionId: params.collectionId,
    scanned: 0,
    deletedDocs: 0,
    deletedFiles: 0,
    deletedNotifications: 0,
    skippedFileDelete: 0,
    fileDeleteErrors: 0,
    docDeleteErrors: 0,
    missingIndexes: 0,
    durationMs: 0,
    byField: [],
  };

  logger.info("[scheduledDataCleanup] Iniciando limpieza de coleccion", {
    collectionId: params.collectionId,
    cutoffTimestamp: params.cutoffTimestamp.toDate().toISOString(),
  });

  const processedPaths = new Set<string>();

  for (const dateField of CLEANUP_SCHEMA[params.collectionId]) {
    const fieldStartedAt = Date.now();
    const filesBefore = stats.deletedFiles;
    const notificationsBefore = stats.deletedNotifications;
    const fieldStats: FieldCleanupStats = {
      field: dateField,
      scanned: 0,
      deletedDocs: 0,
      deletedFiles: 0,
      deletedNotifications: 0,
      errors: 0,
      missingIndexes: 0,
      durationMs: 0,
    };

    try {
      let cursor: QueryDocumentSnapshot | null = null;
      while (true) {
        let queryRef = adminDb
          .collectionGroup(params.collectionId)
          .where(dateField, "<", params.cutoffTimestamp)
          .orderBy(dateField, "asc")
          .limit(QUERY_PAGE_SIZE);

        if (cursor) queryRef = queryRef.startAfter(cursor);

        const snapshot = await queryRef.get();

        if (snapshot.empty) break;

        stats.scanned += snapshot.size;
        fieldStats.scanned += snapshot.size;

        for (const docSnap of snapshot.docs) {
        if (processedPaths.has(docSnap.ref.path)) {
          continue;
        }

        processedPaths.add(docSnap.ref.path);

        if (!canSweepPath(docSnap.ref.path, params.collectionId)) {
          continue;
        }

        const data = docSnap.data() as Record<string, unknown>;
        const effectiveExpirationMillis = latestCleanupDate(data, CLEANUP_SCHEMA[params.collectionId], toMillis);

        if (
          effectiveExpirationMillis === null ||
          effectiveExpirationMillis >= params.cutoffTimestamp.toMillis()
        ) {
          continue;
        }

        if (!(await deleteStorageFileIfPresent({
          rawFilePath: data.filePath,
          defaultBucketName: params.defaultBucketName,
          docPath: docSnap.ref.path,
          stats,
        }))) continue;

        try {
          const meetingContext = params.collectionId === "meetings" ?
            extractMeetingContext(docSnap.ref.path) :
            null;

          if (meetingContext) {
            const assignmentIds = await collectSubcollectionDocIds(
              docSnap.ref,
              "assignments"
            );

            await docSnap.ref.delete({ lastUpdateTime: docSnap.updateTime });
            await deleteRelatedNotificationsForMeeting({
              congregationId: meetingContext.congregationId,
              meetingId: meetingContext.meetingId,
              assignmentIds,
              stats,
            });
          } else {
            await docSnap.ref.delete({ lastUpdateTime: docSnap.updateTime });
          }

          stats.deletedDocs += 1;
          fieldStats.deletedDocs += 1;
        } catch (error) {
          stats.docDeleteErrors += 1;
          fieldStats.errors += 1;
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      fieldStats.errors += 1;
      stats.docDeleteErrors += 1;
      if (message.includes("FAILED_PRECONDITION") || message.includes("index")) {
        fieldStats.missingIndexes += 1;
        stats.missingIndexes += 1;
      }
      logger.error("[scheduledDataCleanup] Error en campo", {
        collectionId: params.collectionId,
        dateField,
        error: message,
      });
    }
    fieldStats.deletedFiles = stats.deletedFiles - filesBefore;
    fieldStats.deletedNotifications =
      stats.deletedNotifications - notificationsBefore;
    fieldStats.durationMs = Date.now() - fieldStartedAt;
    stats.byField.push(fieldStats);
  }

  stats.durationMs = Date.now() - collectionStartedAt;
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
      if (!canSweepInactiveProfile(data)) continue;
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
        await docSnap.ref.delete({ lastUpdateTime: docSnap.updateTime });
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
      acc.missingIndexes += current.missingIndexes;
      acc.durationMs += current.durationMs;
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
      missingIndexes: 0,
      durationMs: 0,
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
        dateFieldsByCollection: CLEANUP_SCHEMA,
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
    const cutoffAt = retentionCutoff(startedAt, RETENTION_MONTHS);
    const cutoffTimestamp = Timestamp.fromDate(cutoffAt);
    const defaultBucketName = getApp().options.storageBucket ?? '';

    logger.info("[scheduledDataCleanup] Inicio de ejecucion", {
      startedAt: startedAt.toISOString(),
      cutoffAt: cutoffAt.toISOString(),
      defaultBucketName,
      cleanupSchema: CLEANUP_SCHEMA,
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
          missingIndexes: 0,
          durationMs: 0,
          byField: [],
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
