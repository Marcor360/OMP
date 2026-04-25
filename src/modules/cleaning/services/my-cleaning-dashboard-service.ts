import AsyncStorage from '@react-native-async-storage/async-storage';

import { getAssignments } from '@/src/modules/assignments/services/assignments.service';
import { Assignment } from '@/src/modules/assignments/types/assignment.types';

const CACHE_PREFIX = '@omp/my-cleaning-dashboard';
const CACHE_VERSION = 1;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const UPCOMING_DAYS = 90;
const MAX_VISIBLE_ASSIGNMENTS = 4;

export interface MyCleaningDay {
  id: string;
  source: Assignment['source'];
  sourceKey: string;
  meetingId?: string;
  title: string;
  date: string;
  status?: Assignment['status'];
  notes?: string;
}

export interface MyCleaningDashboardSummary {
  uid: string;
  congregationId: string;
  groupId: string | null;
  groupName: string | null;
  days: MyCleaningDay[];
  cachedAt: number;
}

interface MyCleaningDashboardParams {
  uid: string;
  congregationId: string;
  cleaningGroupId?: string | null;
  cleaningGroupName?: string | null;
  forceServer?: boolean;
}

const getCacheKey = (uid: string, congregationId: string): string =>
  `${CACHE_PREFIX}:v${CACHE_VERSION}:${uid}:${congregationId}`;

const parseDate = (value: string): Date | null => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfToday = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const addDays = (base: Date, days: number): Date => {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  next.setHours(23, 59, 59, 999);
  return next;
};

const emptySummary = (params: MyCleaningDashboardParams): MyCleaningDashboardSummary => ({
  uid: params.uid,
  congregationId: params.congregationId,
  groupId: params.cleaningGroupId ?? null,
  groupName: params.cleaningGroupName ?? null,
  days: [],
  cachedAt: Date.now(),
});

const belongsToGroup = (
  assignment: Assignment,
  groupId: string,
  groupName?: string | null
): boolean => {
  if (assignment.cleaningGroupId === groupId) return true;
  if (assignment.assignedUsers.some((person) => person.userId === groupId)) return true;

  const normalizedGroupName = groupName?.trim().toLowerCase();
  if (!normalizedGroupName) return false;

  if (assignment.cleaningGroupName?.trim().toLowerCase() === normalizedGroupName) return true;

  return assignment.assignedUsers.some(
    (person) => person.name.trim().toLowerCase() === normalizedGroupName
  );
};

const toCleaningDay = (assignment: Assignment): MyCleaningDay => ({
  id: assignment.id,
  source: assignment.source,
  sourceKey: assignment.sourceKey,
  meetingId: assignment.meetingId,
  title: assignment.title ?? 'Limpieza',
  date: assignment.date,
  status: assignment.status,
  notes: assignment.notes,
});

const isFreshCache = (
  summary: MyCleaningDashboardSummary,
  params: MyCleaningDashboardParams
): boolean =>
  summary.uid === params.uid &&
  summary.congregationId === params.congregationId &&
  summary.groupId === (params.cleaningGroupId ?? null) &&
  Date.now() - summary.cachedAt < CACHE_TTL_MS;

export const readMyCleaningDashboardCache = async (
  uid: string,
  congregationId: string
): Promise<MyCleaningDashboardSummary | null> => {
  const raw = await AsyncStorage.getItem(getCacheKey(uid, congregationId));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as MyCleaningDashboardSummary;
  } catch {
    await AsyncStorage.removeItem(getCacheKey(uid, congregationId));
    return null;
  }
};

export const clearMyCleaningDashboardCache = async (
  uid: string,
  congregationId: string
): Promise<void> => {
  await AsyncStorage.removeItem(getCacheKey(uid, congregationId));
};

export const getMyCleaningDashboardSummary = async (
  params: MyCleaningDashboardParams
): Promise<MyCleaningDashboardSummary> => {
  if (!params.uid || !params.congregationId) {
    return emptySummary(params);
  }

  if (!params.cleaningGroupId) {
    await clearMyCleaningDashboardCache(params.uid, params.congregationId);
    return emptySummary(params);
  }

  if (!params.forceServer) {
    const cached = await readMyCleaningDashboardCache(params.uid, params.congregationId);
    if (cached && isFreshCache(cached, params)) {
      return cached;
    }
  }

  const start = startOfToday();
  const end = addDays(start, UPCOMING_DAYS);
  const assignments = await getAssignments({
    congregationId: params.congregationId,
    bounds: {
      startDate: start,
      endDate: end,
    },
    forceServer: params.forceServer,
  });

  const days = assignments
    .filter((assignment) => assignment.category === 'cleaning')
    .filter((assignment) => assignment.status !== 'completed' && assignment.status !== 'cancelled')
    .filter((assignment) =>
      belongsToGroup(assignment, params.cleaningGroupId!, params.cleaningGroupName)
    )
    .filter((assignment) => {
      const date = parseDate(assignment.date);
      return date ? date >= start && date <= end : false;
    })
    .sort((left, right) => {
      const leftDate = parseDate(left.date)?.getTime() ?? 0;
      const rightDate = parseDate(right.date)?.getTime() ?? 0;
      return leftDate - rightDate;
    })
    .slice(0, MAX_VISIBLE_ASSIGNMENTS)
    .map(toCleaningDay);

  const summary: MyCleaningDashboardSummary = {
    uid: params.uid,
    congregationId: params.congregationId,
    groupId: params.cleaningGroupId,
    groupName: params.cleaningGroupName ?? null,
    days,
    cachedAt: Date.now(),
  };

  await AsyncStorage.setItem(getCacheKey(params.uid, params.congregationId), JSON.stringify(summary));

  return summary;
};
