import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";

const REGION = "us-central1";
const TIME_ZONE = "America/Mexico_City";
const MAX_CONGREGATIONS_PER_RUN = 100;
const MAX_MEETING_PREVIEWS = 3;
const MAX_ASSIGNMENT_PREVIEWS = 5;
const MAX_MEETINGS_FOR_ASSIGNMENT_SUMMARY = 250;
const MAX_ASSIGNMENTS_PER_MEETING = 100;

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toMillis = (value: unknown): number | null => {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === "string") {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const isPendingStatus = (value: unknown): boolean => {
  const status = typeof value === "string" ? value : "pending";
  return status === "pending" || status === "assigned" || status === "in_progress" || status === "overdue";
};

const isCompletedStatus = (value: unknown): boolean => value === "completed";

const normalizeTimestamp = (value: unknown): Timestamp => {
  if (value instanceof Timestamp) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) {
      return Timestamp.fromDate(parsed);
    }
  }
  return Timestamp.now();
};

const refreshDashboardSummary = async (congregationId: string): Promise<void> => {
  const db = getFirestore();
  const now = Timestamp.now();
  const nowMillis = now.toMillis();

  const usersQuery = db
    .collection("users")
    .where("congregationId", "==", congregationId);
  const activeUsersQuery = usersQuery.where("isActive", "==", true);
  const meetingsRef = db
    .collection("congregations")
    .doc(congregationId)
    .collection("meetings");
  const assignmentsRef = db
    .collection("congregations")
    .doc(congregationId)
    .collection("assignments");

  const [
    usersSnap,
    activeUsersSnap,
    meetingsSnap,
    upcomingMeetingsSnap,
    assignmentsSnap,
  ] = await Promise.all([
    usersQuery.limit(250).get(),
    activeUsersQuery.limit(250).get(),
    meetingsRef.limit(250).get(),
    meetingsRef
      .where("startDate", ">=", now)
      .orderBy("startDate", "asc")
      .limit(MAX_MEETING_PREVIEWS)
      .get(),
    assignmentsRef.limit(250).get(),
  ]);

  const standaloneAssignments = assignmentsSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    data: docSnap.data(),
    meetingId: asNonEmptyString(docSnap.data().meetingId),
  }));

  const meetingAssignmentGroups = await Promise.all(
    meetingsSnap.docs.slice(0, MAX_MEETINGS_FOR_ASSIGNMENT_SUMMARY).map(async (meetingDoc) => {
      const snap = await meetingDoc.ref
        .collection("assignments")
        .limit(MAX_ASSIGNMENTS_PER_MEETING)
        .get();

      return snap.docs.map((assignmentDoc) => ({
        id: `${meetingDoc.id}:${assignmentDoc.id}`,
        data: assignmentDoc.data(),
        meetingId: meetingDoc.id,
      }));
    })
  );

  const assignments = [...standaloneAssignments, ...meetingAssignmentGroups.flat()];
  const pendingAssignments = assignments.filter((item) => isPendingStatus(item.data.status));
  const completedAssignments = assignments.filter((item) => isCompletedStatus(item.data.status));
  const overdueAssignments = pendingAssignments.filter((item) => {
    const dueMillis = toMillis(item.data.dueDate ?? item.data.date);
    return dueMillis !== null && dueMillis < nowMillis;
  });

  await db.collection("dashboardSummary").doc(congregationId).set(
    {
      congregationId,
      metrics: {
        totalUsers: usersSnap.size,
        activeUsers: activeUsersSnap.size,
        totalMeetings: meetingsSnap.size,
        scheduledMeetings: meetingsSnap.docs.filter((docSnap) => docSnap.data().status === "scheduled").length,
        totalAssignments: assignments.length,
        pendingAssignments: pendingAssignments.length,
        completedAssignments: completedAssignments.length,
        overdueAssignments: overdueAssignments.length,
      },
      upcomingMeetings: upcomingMeetingsSnap.docs.map((docSnap) => {
        const data = docSnap.data();
        const startDate = normalizeTimestamp(data.startDate ?? data.meetingDate);
        return {
          id: docSnap.id,
          title: asNonEmptyString(data.title) ?? "Reunion",
          status: asNonEmptyString(data.status) ?? "scheduled",
          type: asNonEmptyString(data.type) ?? "weekend",
          meetingCategory: asNonEmptyString(data.meetingCategory) ?? null,
          startDate,
          endDate: normalizeTimestamp(data.endDate ?? startDate),
          location: asNonEmptyString(data.location) ?? null,
        };
      }),
      pendingAssignments: pendingAssignments
        .sort((left, right) => {
          const leftMillis = toMillis(left.data.dueDate ?? left.data.date) ?? Number.MAX_SAFE_INTEGER;
          const rightMillis = toMillis(right.data.dueDate ?? right.data.date) ?? Number.MAX_SAFE_INTEGER;
          return leftMillis - rightMillis;
        })
        .slice(0, MAX_ASSIGNMENT_PREVIEWS)
        .map((item) => ({
          id: item.id,
          title: asNonEmptyString(item.data.title) ?? "Asignacion",
          status: asNonEmptyString(item.data.status) ?? "pending",
          priority: asNonEmptyString(item.data.priority) ?? "medium",
          dueDate: normalizeTimestamp(item.data.dueDate ?? item.data.date),
          assignedToUid: asNonEmptyString(item.data.assignedToUid) ?? null,
          assignedToName: asNonEmptyString(item.data.assignedToName) ?? null,
          meetingId: asNonEmptyString(item.data.meetingId) ?? item.meetingId,
        })),
      generatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
};

const getRequesterCongregationId = async (uid: string): Promise<string> => {
  const snap = await getFirestore().collection("users").doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError("permission-denied", "No se encontro el perfil del usuario.");
  }

  const data = snap.data() as Record<string, unknown>;
  const congregationId = asNonEmptyString(data.congregationId);
  const role = asNonEmptyString(data.role);

  if (data.isActive !== true || !congregationId || role !== "admin") {
    throw new HttpsError("permission-denied", "Solo un administrador activo puede refrescar el resumen.");
  }

  return congregationId;
};

export const refreshDashboardSummaryForCurrentCongregation = onCall(
  {
    region: REGION,
    timeoutSeconds: 120,
    memory: "256MiB",
    maxInstances: 3,
  },
  async (request): Promise<{ ok: true }> => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesion.");
    }

    const congregationId = await getRequesterCongregationId(request.auth.uid);
    await refreshDashboardSummary(congregationId);
    return { ok: true };
  }
);

export const scheduledDashboardSummaryRefresh = onSchedule(
  {
    schedule: "every 60 minutes",
    timeZone: TIME_ZONE,
    region: REGION,
    timeoutSeconds: 540,
    memory: "512MiB",
    maxInstances: 1,
  },
  async () => {
    const db = getFirestore();
    const congregationsSnap = await db
      .collection("congregations")
      .where("isActive", "==", true)
      .limit(MAX_CONGREGATIONS_PER_RUN)
      .get();

    for (const congregationDoc of congregationsSnap.docs) {
      try {
        await refreshDashboardSummary(congregationDoc.id);
      } catch (error) {
        logger.error("Failed to refresh dashboard summary", {
          congregationId: congregationDoc.id,
          error,
        });
      }
    }
  }
);
