import { Timestamp } from 'firebase/firestore';

import { Assignment } from '@/src/types/assignment';
import { getMeetingsByWeek } from '@/src/services/meetings/meetings-service';
import {
  getDashboardSummary,
  getEmptyDashboardMetrics,
} from '@/src/services/repositories/dashboard-summary-repository';
import { DashboardMetrics, DashboardSummary } from '@/src/types/dashboard';
import { Meeting } from '@/src/types/meeting';
import { isFirebaseErrorCode } from '@/src/lib/firebase/errors';
import { getAssignments as getPanelAssignments } from '@/src/modules/assignments/services/assignments.service';
import { Assignment as PanelAssignment } from '@/src/modules/assignments/types/assignment.types';
import { getAllUsers } from '@/src/services/users/users-service';

const PENDING_PANEL_STATUSES = new Set(['pending', 'assigned', 'in_progress', 'overdue']);

const MEETING_ASSIGNMENT_CATEGORIES = new Set(['midweek', 'weekend']);

const startOfTodayMillis = (): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
};

const toMillis = (value: string | Timestamp | undefined): number | null => {
  if (!value) return null;

  const millis = typeof value === 'string' ? new Date(value).getTime() : value.toMillis();

  return Number.isFinite(millis) ? millis : null;
};

const endOfWeekMillis = (millis: number): number => {
  const date = new Date(millis);
  date.setHours(23, 59, 59, 999);

  const day = date.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  date.setDate(date.getDate() + daysUntilSunday);

  return date.getTime();
};

const isMeetingPanelAssignment = (assignment: PanelAssignment): boolean =>
  Boolean(assignment.meetingId) ||
  MEETING_ASSIGNMENT_CATEGORIES.has(assignment.category);

const getPanelAssignmentExpirationMillis = (assignment: PanelAssignment): number | null => {
  const millis = toMillis(assignment.date);
  if (millis === null) return null;

  return isMeetingPanelAssignment(assignment) ? endOfWeekMillis(millis) : millis;
};

const getDashboardAssignmentExpirationMillis = (assignment: Assignment): number | null => {
  const millis = toMillis(assignment.dueDate);
  if (millis === null) return null;

  return assignment.meetingId ? endOfWeekMillis(millis) : millis;
};

const countOverduePanelAssignments = (assignments: PanelAssignment[]): number => {
  const now = Date.now();

  return assignments.filter((assignment) => {
    if (assignment.status && !PENDING_PANEL_STATUSES.has(assignment.status)) return false;
    const expiresAt = getPanelAssignmentExpirationMillis(assignment);
    return expiresAt !== null && expiresAt < now;
  }).length;
};

const isPanelAssignmentPending = (assignment: PanelAssignment): boolean => {
  if (!assignment.status) return true;
  return PENDING_PANEL_STATUSES.has(assignment.status);
};

const isPanelAssignmentUpcoming = (assignment: PanelAssignment): boolean =>
  (getPanelAssignmentExpirationMillis(assignment) ?? 0) >= startOfTodayMillis();

const isDashboardAssignmentUpcoming = (assignment: Assignment): boolean =>
  (getDashboardAssignmentExpirationMillis(assignment) ?? 0) >= startOfTodayMillis();

const isPanelAssignmentCompleted = (assignment: PanelAssignment): boolean =>
  assignment.status === 'completed';

const isPanelAssignmentForUser = (assignment: PanelAssignment, uid: string): boolean =>
  assignment.assignedUsers.some((person) => person.userId === uid);

const toTimestamp = (value: string | undefined): Timestamp => {
  if (!value) return Timestamp.now();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? Timestamp.now() : Timestamp.fromDate(parsed);
};

const mapPanelAssignmentToDashboardCard = (assignment: PanelAssignment): Assignment => {
  const primaryAssignee = assignment.assignedUsers[0];
  const dueDate = toTimestamp(assignment.date);
  const isEffectivelyOverdue =
    (getPanelAssignmentExpirationMillis(assignment) ?? Number.POSITIVE_INFINITY) < Date.now();
  const status =
    assignment.status === 'completed' ||
    assignment.status === 'cancelled' ||
    (assignment.status === 'overdue' && isEffectivelyOverdue) ||
    assignment.status === 'in_progress'
      ? assignment.status
      : 'pending';

  return {
    id: assignment.id,
    title: assignment.title ?? assignment.notes ?? 'Asignacion',
    description: assignment.notes,
    status,
    priority: 'medium',
    assignedToUid: primaryAssignee?.userId ?? assignment.cleaningGroupId ?? '',
    assignedToName: primaryAssignee?.name ?? assignment.cleaningGroupName ?? 'Sin asignar',
    assignedByUid: 'system',
    assignedByName: 'Sistema',
    category:
      assignment.category === 'cleaning'
        ? 'cleaning'
        : assignment.category === 'hospitality'
          ? 'hospitality'
          : 'platform',
    cleaningGroupId: assignment.cleaningGroupId,
    cleaningGroupName: assignment.cleaningGroupName,
    dueDate,
    meetingId: assignment.meetingId,
    createdAt: toTimestamp(assignment.createdAt) || dueDate,
    updatedAt: toTimestamp(assignment.updatedAt) || dueDate,
  };
};

const toVisibleMeetingsRange = (baseDate = new Date()): { start: Date; end: Date } => {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setMonth(end.getMonth() + 18);
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
    return mapped.filter(isDashboardAssignmentUpcoming).slice(0, 5);
  }

  return mapped
    .filter((assignment) => !assignment.assignedToUid || assignment.assignedToUid === uid)
    .filter(isDashboardAssignmentUpcoming)
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
      const userAssignments = (await getPanelAssignments({
        congregationId,
        forceServer,
      })).filter((assignment) => isPanelAssignmentForUser(assignment, uid));
      const pending = userAssignments
        .filter(isPanelAssignmentPending)
        .filter(isPanelAssignmentUpcoming);
      const completed = userAssignments.filter(isPanelAssignmentCompleted);

      return {
        metrics: {
          totalAssignments: userAssignments.length,
          pendingAssignments: pending.length,
          completedAssignments: completed.length,
          overdueAssignments: countOverduePanelAssignments(userAssignments),
        },
        recentMeetings: mapSummaryMeetingsToCards(summary),
        pendingAssignments: pending.slice(0, 5).map(mapPanelAssignmentToDashboardCard),
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

  const { start, end } = toVisibleMeetingsRange();

  const [meetings, panelAssignments, users] = await Promise.all([
    getMeetingsByWeek(congregationId, start, end, {
      includeMidweek: true,
      publicationStatus: 'published',
      maxItems: 120,
      forceServer,
    }),
    getPanelAssignments({
      congregationId,
      forceServer,
    }),
    isAdmin
      ? getAllUsers(congregationId, { forceServer }).catch(() => [])
      : Promise.resolve([]),
  ]);

  const visibleAssignments = canManageAssignments
    ? panelAssignments
    : panelAssignments.filter((assignment) => isPanelAssignmentForUser(assignment, uid));
  const pending = visibleAssignments
    .filter(isPanelAssignmentPending)
    .filter(isPanelAssignmentUpcoming);
  const completed = visibleAssignments.filter(isPanelAssignmentCompleted);
  const metrics: Partial<DashboardMetrics> = {
    ...getEmptyDashboardMetrics(),
    totalMeetings: meetings.length,
    scheduledMeetings: meetings.filter((meeting) => meeting.status === 'scheduled').length,
    totalAssignments: visibleAssignments.length,
    pendingAssignments: pending.length,
    completedAssignments: completed.length,
    overdueAssignments: countOverduePanelAssignments(visibleAssignments),
  };

  if (isAdmin) {
    metrics.totalUsers = users.length;
    metrics.activeUsers = users.filter((item) => item.isActive).length;
  } else {
    delete metrics.totalUsers;
    delete metrics.activeUsers;
  }

  return {
    metrics,
    recentMeetings: meetings.slice(0, 3),
    pendingAssignments: pending.slice(0, 5).map(mapPanelAssignmentToDashboardCard),
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
