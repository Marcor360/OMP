import { logger } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";

import { adminDb } from "./config/firebaseAdmin.js";

const REGION = "us-central1";
const TIME_ZONE = "America/Mexico_City";
const MONTHLY_ASSIGNMENTS = "monthlyTerritoryAssignments";

const getMonthId = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export const scheduledMonthlyTerritoryAssignmentsCleanup = onSchedule(
  {
    schedule: "0 2 * * *",
    timeZone: TIME_ZONE,
    region: REGION,
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async () => {
    const currentMonthId = getMonthId(new Date());
    const congregations = await adminDb.collection("congregations").get();
    let scanned = 0;
    let deleted = 0;

    for (const congregationDoc of congregations.docs) {
      const assignments = await congregationDoc.ref
        .collection(MONTHLY_ASSIGNMENTS)
        .where("monthId", "<", currentMonthId)
        .get();

      scanned += assignments.size;

      if (assignments.empty) continue;

      const batch = adminDb.batch();
      assignments.docs.forEach((assignmentDoc) => {
        batch.delete(assignmentDoc.ref);
        deleted += 1;
      });
      await batch.commit();
    }

    logger.info("[territories] monthly assignment cleanup complete", {
      currentMonthId,
      scanned,
      deleted,
    });
  }
);

