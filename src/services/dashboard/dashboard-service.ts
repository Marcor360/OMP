import { Timestamp } from 'firebase/firestore';

import { Assignment } from '@/src/types/assignment';
import { getAssignmentsByWeek } from '@/src/services/assignments/assignments-service';
import { getMeetingsByWeek } from '@/src/services/meetings/meetings-service';
import {
  getDashboardSummary,
  getEmptyDashboardMetrics,
} from '@/src/services/repositories/dashboard-summary-repository';
import { DashboardMetrics, DashboardSummary } from '@/src/types/dashboard';
import { Meeting } from '@/src/types/meeting';
import { isFirebaseErrorCode } from '@/src/lib/firebase/errors';

const countOverduePending = (assignments: Assignment[]): number => {
  const now = Date.now();

  return assignments.filter((assignment) => {
    if (assignment.status !== 'pending' || !assignment.dueDate) return false;
    return assignment.dueDate.toDate().getTime() < now;
  }).length;
};

const toWeekRange = (baseDate = new Date()): { start: Date; end: Date } => {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);

  const day = start.getDay();
  const daysToMonday = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - daysToMonday);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const fallbackMeeting = (id: string): Meeting => {
  const now = Timestamp.now();

  return {
    id,
    title: 'Reunion',
    type: 'weekend',
    meetingCategory: 'general',
    status: 'scheduled',
    startDate: now,
    endDate: now,
    organizerUid: 'system',
    organizerName: 'Sistema',
    attendees: [],
    createdAt: now,
    updatedAt: now,
  };
};

const fallbackAssignment = (id: string): Assignment => ({
  id,
  title: 'Asignacion',
  status: 'pending',
  priority: 'medium',
  assignedToUid: '',
  assignedToName: 'Sin asignar',
  assignedByUid: 'system',
  assignedByName: 'Sistema',
  dueDate: Timestamp.now(),
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
});

const mapSummaryMeetingsToCards = (summary: DashboardSummary): Meeting[] =>
  summary.upcomingMeetings.slice(0, 3).map((item, index) => ({
    ...fallbackMeeting(item.id || `summary-meeting-${index + 1}`),
    id: item.id || `summary-meeting-${index + 1}`,
    title: item.title,
    status: item.status ?? 'scheduled',
    type: item.type ?? 'weekend',
    meetingCategory:
      item.meetingCategory ??
      (item.type === 'midweek' ? 'midweek' : item.type === 'weekend' ? 'weekend' : 'general'),
    startDate: item.startDate,
    endDate: item.endDate ?? item.startDate,
    location: item.location,
  }));

const mapSummaryAssignmentsToCards = (
  summary: DashboardSummary,
  uid?: string,
  includeAll = false
): Assignment[] => {
  const mapped = summary.pendingAssignments.map((item, index) => ({
    ...fallbackAssignment(item.id || `summary-assignment-${index + 1}`),
    id: item.id || `summary-assignment-${index + 1}`,
    title: item.title,
    status: item.status ?? 'pending',
    priority: item.priority ?? 'medium',
    dueDate: item.dueDate,
    assignedToUid: item.assignedToUid ?? '',
    assignedToName: item.assignedToName ?? 'Sin asignar',
    meetingId: item.meetingId,
  }));

  if (includeAll || !uid) {
    return mapped.slice(0, 5);
  }

  return mapped
    .filter((assignment) => !assignment.assignedToUid || assignment.assignedToUid === uid)
    .slice(0, 5);
};

export interface DashboardData {
  metrics: Partial<DashboardMetrics>;
  recentMeetings: Meeting[];
  pendingAssignments: Assignment[];
  usedSummary: boolean;
}

/** Carga datos de dashboard minimizando lecturas masivas */
export const getDashboardData = async (params: {
  congregationId: string;
  uid: string;
  isAdmin: boolean;
  canManageAssignments: boolean;
  forceServer?: boolean;
}): Promise<DashboardData> => {
  const { congregationId, uid, isAdmin, canManageAssignments, forceServer } = params;
  // TODO(firebase): Mantener dashboardSummary/{congregationId} actualizado desde Cloud Functions
  // o un proceso admin para evitar que el fallback semanal sea la fuente principal.
  let summary: DashboardSummary | null = null;

  try {
    summary = await getDashboardSummary(congregationId, { forceServer });
  } catch (error) {
    // Si la coleccion dashboardSummary no esta permitida por reglas o no existe aun,
    // continuamos con fallback semanal para no romper la pantalla de inicio.
    const canFallbackSilently =
      isFirebaseErrorCode(error, 'permission-denied') ||
      isFirebaseErrorCode(error, 'not-found') ||
      isFirebaseErrorCode(error, 'failed-precondition');

    if (!canFallbackSilently && __DEV__) {
      console.warn('Dashboard summary read failed, using fallback weekly mode:', error);
    }
  }

  if (summary) {
    if (!canManageAssignments) {
      const { start, end } = toWeekRange();
      const userAssignments = await getAssignmentsByWeek(congregationId, start, end, {
        userUid: uid,
        forceServer,
        maxMeetings: 35,
        perMeetingLimit: 30,
      });
      const pending = userAssignments.filter((item) => item.status === 'pending');
      const completed = userAssignments.filter((item) => item.status === 'completed');

      return {
        metrics: {
          totalAssignments: userAssignments.length,
          pendingAssignments: pending.length,
          completedAssignments: completed.length,
          overdueAssignments: countOverduePending(userAssignments),
        },
        recentMeetings: mapSummaryMeetingsToCards(summary),
        pendingAssignments: pending.slice(0, 5),
        usedSummary: true,
      };
    }

    const metrics = isAdmin
      ? summary.metrics
      : {
          totalAssignments: summary.metrics.totalAssignments,
          pendingAssignments: summary.metrics.pendingAssignments,
          completedAssignments: summary.metrics.completedAssignments,
          overdueAssignments: summary.metrics.overdueAssignments,
        };

    return {
      metrics,
      recentMeetings: mapSummaryMeetingsToCards(summary),
      pendingAssignments: mapSummaryAssignmentsToCards(summary, uid, canManageAssignments),
      usedSummary: true,
    };
  }

  const { start, end } = toWeekRange();

  const [meetings, assignments] = await Promise.all([
    getMeetingsByWeek(congregationId, start, end, {
      includeMidweek: false,
      maxItems: 40,
      forceServer,
    }),
    getAssignmentsByWeek(congregationId, start, end, {
      userUid: canManageAssignments ? undefined : uid,
      maxMeetings: 40,
      perMeetingLimit: 35,
      forceServer,
    }),
  ]);

  const pending = assignments.filter((item) => item.status === 'pending');
  const completed = assignments.filter((item) => item.status === 'completed');
  const metrics: Partial<DashboardMetrics> = {
    ...getEmptyDashboardMetrics(),
    totalMeetings: meetings.length,
    scheduledMeetings: meetings.filter((meeting) => meeting.status === 'scheduled').length,
    totalAssignments: assignments.length,
    pendingAssignments: pending.length,
    completedAssignments: completed.length,
    overdueAssignments: countOverduePending(assignments),
  };

  if (!isAdmin) {
    delete metrics.totalUsers;
    delete metrics.activeUsers;
  }

  return {
    metrics,
    recentMeetings: meetings.slice(0, 3),
    pendingAssignments: pending.slice(0, 5),
    usedSummary: false,
  };
};

/** Compatibilidad: obtiene metricas usando la nueva estrategia de dashboard summary */
export const getDashboardMetrics = async (
  congregationId: string
): Promise<DashboardMetrics> => {
  const data = await getDashboardData({
    congregationId,
    uid: '',
    isAdmin: true,
    canManageAssignments: true,
  });

  return {
    ...getEmptyDashboardMetrics(),
    ...data.metrics,
  };
};

/** Compatibilidad: metricas de usuario regular sin lecturas masivas */
export const getDashboardMetricsForUser = async (
  congregationId: string,
  uid: string
): Promise<Partial<DashboardMetrics>> => {
  const data = await getDashboardData({
    congregationId,
    uid,
    isAdmin: false,
    canManageAssignments: false,
  });

  return data.metrics;
};
