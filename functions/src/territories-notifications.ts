import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";

import { adminDb } from "./config/firebaseAdmin.js";

const REGION = "us-central1";
const TIME_ZONE = "America/Mexico_City";
const MONTHLY_ASSIGNMENTS = "monthlyTerritoryAssignments";
const NOTIFICATIONS = "notifications";

const getMonthId = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const getNextMonth = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth() + 1, 1);

const getDaysUntilEndOfMonth = (date: Date): number => {
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return end.getDate() - date.getDate();
};

const isPreachingManagerOrAssistant = (data: Record<string, unknown>): boolean => {
  const isPreachingDepartment =
    data.serviceDepartment === "predicacion" || data.serviceDepartment === "territorios";

  if (
    data.servicePosition &&
    (data.servicePosition === "encargado" || data.servicePosition === "auxiliar") &&
    isPreachingDepartment
  ) {
    return true;
  }

  if (!Array.isArray(data.serviceAssignments)) return false;

  return data.serviceAssignments.some((assignment) => {
    if (!assignment || typeof assignment !== "object") return false;
    const item = assignment as Record<string, unknown>;
    return (
      (item.position === "encargado" || item.position === "auxiliar") &&
      (item.department === "predicacion" || item.department === "territorios")
    );
  });
};

const getMonthName = (date: Date): string =>
  new Intl.DateTimeFormat("es-MX", {month: "long"}).format(date);

export const remindNextMonthTerritoryAssignments = onSchedule(
  {
    schedule: "30 8 * * *",
    timeZone: TIME_ZONE,
    region: REGION,
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async () => {
    const now = new Date();
    if (getDaysUntilEndOfMonth(now) > 5) {
      logger.info("[territories] reminder skipped; month end is not close");
      return;
    }

    const nextMonth = getNextMonth(now);
    const nextMonthId = getMonthId(nextMonth);
    const nextMonthName = getMonthName(nextMonth);
    const congregations = await adminDb.collection("congregations").get();
    let notificationsCreated = 0;

    for (const congregationDoc of congregations.docs) {
      const assignmentDoc = await congregationDoc.ref
        .collection(MONTHLY_ASSIGNMENTS)
        .doc(nextMonthId)
        .get();

      if (assignmentDoc.exists) continue;

      const users = await adminDb
        .collection("users")
        .where("congregationId", "==", congregationDoc.id)
        .where("isActive", "==", true)
        .get();

      const recipients = users.docs.filter((userDoc) =>
        isPreachingManagerOrAssistant(userDoc.data() as Record<string, unknown>)
      );

      if (recipients.length === 0) continue;

      const batch = adminDb.batch();

      recipients.forEach((userDoc) => {
        const notificationId = `territories_next_month_${nextMonthId}_${userDoc.id}`;
        batch.set(
          congregationDoc.ref.collection(NOTIFICATIONS).doc(notificationId),
          {
            userId: userDoc.id,
            userIds: [userDoc.id],
            congregationId: congregationDoc.id,
            title: "Territorios del proximo mes",
            body: `Faltan pocos dias para terminar el mes. Agrega los territorios de ${nextMonthName}.`,
            type: "assignment",
            category: "platform",
            assignmentId: `territories:${nextMonthId}`,
            isRead: false,
            data: {
              url: "/(protected)/territories/manage",
            },
            createdAt: FieldValue.serverTimestamp(),
            sentBy: null,
            metadata: {
              monthId: nextMonthId,
              role: "territories-reminder",
            },
          },
          {merge: true}
        );
        notificationsCreated += 1;
      });

      await batch.commit();
    }

    logger.info("[territories] next month reminders complete", {
      nextMonthId,
      notificationsCreated,
    });
  }
);
