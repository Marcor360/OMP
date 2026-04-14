import { getStorage } from "firebase-admin/storage";
import {
  FieldValue,
  Timestamp,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";

import { adminDb } from "../config/firebaseAdmin.js";

const CLEANUP_SCHEDULE = "0 0 1 */2 *";
const CLEANUP_TIME_ZONE = "America/Mexico_City";
const RETENTION_MONTHS = 2;
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

type TargetCollectionId = (typeof TARGET_COLLECTION_IDS)[number];

type CollectionCleanupStats = {
  collectionId: TargetCollectionId;
  scanned: number;
  deletedDocs: number;
  deletedFiles: number;
  skippedFileDelete: number;
  fileDeleteErrors: number;
  docDeleteErrors: number;
};

type CleanupRunSummary = {
  startedAt: string;
  finishedAt: string;
  cutoffAt: string;
  retentionMonths: number;
  schedule: string;
  timeZone: string;
  totals: {
    scanned: number;
    deletedDocs: number;
    deletedFiles: number;
    skippedFileDelete: number;
    fileDeleteErrors: number;
    docDeleteErrors: number;
  };
  byCollection: CollectionCleanupStats[];
};

const subtractMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
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
    skippedFileDelete: 0,
    fileDeleteErrors: 0,
    docDeleteErrors: 0,
  };

  logger.info("[scheduledDataCleanup] Iniciando limpieza de coleccion", {
    collectionId: params.collectionId,
    cutoffTimestamp: params.cutoffTimestamp.toDate().toISOString(),
  });

  let cursor: QueryDocumentSnapshot | null = null;

  while (true) {
    let queryRef = adminDb
      .collectionGroup(params.collectionId)
      .where("createdAt", "<", params.cutoffTimestamp)
      .orderBy("createdAt", "asc")
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

      await deleteStorageFileIfPresent({
        rawFilePath: data.filePath,
        defaultBucketName: params.defaultBucketName,
        docPath: docSnap.ref.path,
        stats,
      });

      try {
        await docSnap.ref.delete();
        stats.deletedDocs += 1;
      } catch (error) {
        stats.docDeleteErrors += 1;
        logger.error("[scheduledDataCleanup] Error eliminando documento", {
          docPath: docSnap.ref.path,
          collectionId: params.collectionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    cursor = snapshot.docs[snapshot.docs.length - 1];
  }

  logger.info("[scheduledDataCleanup] Coleccion procesada", stats);

  return stats;
};

const buildRunSummary = (params: {
  startedAt: Date;
  finishedAt: Date;
  cutoffAt: Date;
  statsByCollection: CollectionCleanupStats[];
}): CleanupRunSummary => {
  const totals = params.statsByCollection.reduce(
    (acc, current) => {
      acc.scanned += current.scanned;
      acc.deletedDocs += current.deletedDocs;
      acc.deletedFiles += current.deletedFiles;
      acc.skippedFileDelete += current.skippedFileDelete;
      acc.fileDeleteErrors += current.fileDeleteErrors;
      acc.docDeleteErrors += current.docDeleteErrors;
      return acc;
    },
    {
      scanned: 0,
      deletedDocs: 0,
      deletedFiles: 0,
      skippedFileDelete: 0,
      fileDeleteErrors: 0,
      docDeleteErrors: 0,
    }
  );

  return {
    startedAt: params.startedAt.toISOString(),
    finishedAt: params.finishedAt.toISOString(),
    cutoffAt: params.cutoffAt.toISOString(),
    retentionMonths: RETENTION_MONTHS,
    schedule: CLEANUP_SCHEDULE,
    timeZone: CLEANUP_TIME_ZONE,
    totals,
    byCollection: params.statsByCollection,
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
        retentionMonths: RETENTION_MONTHS,
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
    const cutoffAt = subtractMonths(startedAt, RETENTION_MONTHS);
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
          skippedFileDelete: 0,
          fileDeleteErrors: 0,
          docDeleteErrors: 1,
        });
      }
    }

    const finishedAt = new Date();
    const summary = buildRunSummary({
      startedAt,
      finishedAt,
      cutoffAt,
      statsByCollection,
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
