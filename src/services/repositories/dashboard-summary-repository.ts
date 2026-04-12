import { Timestamp } from 'firebase/firestore';

import { dashboardSummaryDocRef } from '@/src/lib/firebase/refs';
import { getDocumentCacheFirst } from '@/src/services/repositories/firestore-cache-first';
import {
  DashboardMetrics,
  DashboardSummary,
  DashboardSummaryAssignmentPreview,
  DashboardSummaryMeetingPreview,
} from '@/src/types/dashboard';

const DASHBOARD_SUMMARY_CACHE_TTL_MS = 2 * 60 * 1000;

const EMPTY_METRICS: DashboardMetrics = {
  totalUsers: 0,
  activeUsers: 0,
  totalMeetings: 0,
  scheduledMeetings: 0,
  totalAssignments: 0,
  pendingAssignments: 0,
  completedAssignments: 0,
  overdueAssignments: 0,
};

const normalizeNumber = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return value;
};

const normalizeTimestamp = (value: unknown): Timestamp | undefined => {
  if (value instanceof Timestamp) return value;

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    return Timestamp.fromDate((value as { toDate: () => Date }).toDate());
  }

  return undefined;
};

const normalizeMetrics = (value: unknown): DashboardMetrics => {
  const raw = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

  return {
    totalUsers: normalizeNumber(raw.totalUsers),
    activeUsers: normalizeNumber(raw.activeUsers),
    totalMeetings: normalizeNumber(raw.totalMeetings),
    scheduledMeetings: normalizeNumber(raw.scheduledMeetings),
    totalAssignments: normalizeNumber(raw.totalAssignments),
    pendingAssignments: normalizeNumber(raw.pendingAssignments),
    completedAssignments: normalizeNumber(raw.completedAssignments),
    overdueAssignments: normalizeNumber(raw.overdueAssignments),
  };
};

const normalizeMeetingPreview = (
  value: unknown,
  index: number
): DashboardSummaryMeetingPreview => {
  const raw = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const startDate = normalizeTimestamp(raw.startDate) ?? Timestamp.now();
  const endDate = normalizeTimestamp(raw.endDate);

  return {
    id: typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id : `meeting-${index + 1}`,
    title: typeof raw.title === 'string' && raw.title.trim().length > 0 ? raw.title : 'Reunion',
    status: typeof raw.status === 'string' ? (raw.status as DashboardSummaryMeetingPreview['status']) : undefined,
    type: typeof raw.type === 'string' ? (raw.type as DashboardSummaryMeetingPreview['type']) : undefined,
    meetingCategory:
      typeof raw.meetingCategory === 'string'
        ? (raw.meetingCategory as DashboardSummaryMeetingPreview['meetingCategory'])
        : undefined,
    startDate,
    endDate,
    location: typeof raw.location === 'string' ? raw.location : undefined,
  };
};

const normalizeAssignmentPreview = (
  value: unknown,
  index: number
): DashboardSummaryAssignmentPreview => {
  const raw = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

  return {
    id: typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id : `assignment-${index + 1}`,
    title: typeof raw.title === 'string' && raw.title.trim().length > 0 ? raw.title : 'Asignacion',
    status: typeof raw.status === 'string' ? (raw.status as DashboardSummaryAssignmentPreview['status']) : undefined,
    priority:
      typeof raw.priority === 'string'
        ? (raw.priority as DashboardSummaryAssignmentPreview['priority'])
        : undefined,
    dueDate: normalizeTimestamp(raw.dueDate) ?? Timestamp.now(),
    assignedToName: typeof raw.assignedToName === 'string' ? raw.assignedToName : undefined,
    assignedToUid: typeof raw.assignedToUid === 'string' ? raw.assignedToUid : undefined,
    meetingId: typeof raw.meetingId === 'string' ? raw.meetingId : undefined,
  };
};

const normalizeSummary = (
  congregationId: string,
  data: Record<string, unknown>
): DashboardSummary => {
  const upcomingMeetings = Array.isArray(data.upcomingMeetings)
    ? data.upcomingMeetings.map((item, index) => normalizeMeetingPreview(item, index))
    : [];
  const pendingAssignments = Array.isArray(data.pendingAssignments)
    ? data.pendingAssignments.map((item, index) => normalizeAssignmentPreview(item, index))
    : [];

  return {
    congregationId,
    metrics: normalizeMetrics(data.metrics),
    upcomingMeetings,
    pendingAssignments,
    generatedAt: normalizeTimestamp(data.generatedAt),
    updatedAt: normalizeTimestamp(data.updatedAt),
  };
};

const isSummaryIncomplete = (summary: DashboardSummary): boolean => {
  if (!summary.congregationId || summary.congregationId.trim().length === 0) {
    return true;
  }

  const values = Object.values(summary.metrics);
  return values.some((value) => !Number.isFinite(value) || value < 0);
};

export const getDashboardSummary = async (
  congregationId: string,
  options?: { forceServer?: boolean }
): Promise<DashboardSummary | null> => {
  if (!congregationId || typeof congregationId !== 'string') {
    return null;
  }

  return getDocumentCacheFirst<DashboardSummary>({
    cacheKey: `dashboard-summary/${congregationId}`,
    ref: dashboardSummaryDocRef(congregationId),
    mapSnapshot: (snapshot) => normalizeSummary(congregationId, snapshot.data() as Record<string, unknown>),
    maxAgeMs: DASHBOARD_SUMMARY_CACHE_TTL_MS,
    forceServer: options?.forceServer,
    isIncomplete: isSummaryIncomplete,
  });
};

export const getEmptyDashboardMetrics = (): DashboardMetrics => ({ ...EMPTY_METRICS });

