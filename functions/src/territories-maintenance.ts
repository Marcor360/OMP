import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { logger } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";

import { adminDb } from "./config/firebaseAdmin.js";

const REGION = "us-central1";
const TIME_ZONE = "America/Mexico_City";
const MONTHLY_ASSIGNMENTS = "monthlyTerritoryAssignments";

const monthFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit',
});
const getMonthId = (date: Date): string => {
  const parts = new Map(monthFormat.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.get('year')}-${parts.get('month')}`;
};

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
      const query = congregationDoc.ref.collection(MONTHLY_ASSIGNMENTS)
        .where("monthId", "<", currentMonthId).orderBy('monthId').limit(200);
      let cursor: QueryDocumentSnapshot | undefined;
      while (true) {
        const assignments = await (cursor ? query.startAfter(cursor) : query).get();
        if (assignments.empty) break;
        cursor = assignments.docs[assignments.docs.length - 1];
        scanned += assignments.size;
        const expired = assignments.docs.filter((doc) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(doc.get('monthId'))));
        if (expired.length === 0) continue;
        const batch = adminDb.batch();
        expired.forEach((doc) => batch.delete(doc.ref, { lastUpdateTime: doc.updateTime }));
        try {
          await batch.commit();
          deleted += expired.length;
        } catch (error) {
          logger.warn('[territories] monthly cleanup page skipped', { congregationId: congregationDoc.id, error });
        }
      }
    }

    logger.info("[territories] monthly assignment cleanup complete", {
      currentMonthId,
      scanned,
      deleted,
    });
  }
);

