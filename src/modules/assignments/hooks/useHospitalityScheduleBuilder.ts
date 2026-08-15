import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useUser } from '@/src/context/user-context';
import { useI18n } from '@/src/i18n';
import { getScheduledOutgoingTalksInRange } from '@/src/modules/assignments/services/outgoing-talks.service';
import {
  archiveHospitalitySchedule,
  ensurePlanningMeetings,
  getHospitalityScheduleItems,
  getHospitalitySchedules,
  publishHospitalitySchedule,
  saveHospitalityScheduleDraft,
  substituteHospitalityAssignment,
} from '@/src/services/hospitality-microphones/hospitality-microphones-service';
import type {
  DroppedHospitalityScheduleItem,
  SaveHospitalityScheduleDraftItem,
} from '@/src/services/repositories/ports/hospitality-schedule-repository.port';
import { getMeetingsByWeek } from '@/src/services/meetings/meetings-service';
import { validatePlanningWindow } from '@/src/services/planning/operational-planning-service';
import {
  type ActiveCongregationUser,
  getActiveCongregationUsers,
} from '@/src/services/users/active-users-service';
import type {
  HospitalityMeetingType,
  HospitalityOptionalRoles,
  HospitalityRoleKey,
  HospitalitySchedule,
  HospitalityScheduleItem,
} from '@/src/types/hospitality-microphones';
import type { Meeting } from '@/src/types/meeting';
import { formatDateKey, parseDateKey } from '@/src/utils/dates/date-key';
import { getWeekRangeForDate } from '@/src/utils/dates/week-range';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import {
  canEditHospitalityAssignments,
  canManageHospitalityMicrophones,
} from '@/src/utils/permissions/permissions';
import { confirmAlert, showAlert } from '@/src/utils/ui/alerts';

export type HospitalityPlanningRow = {
  meetingId: string;
  meetingTitle: string;
  meetingDate: string;
  meetingType: HospitalityMeetingType;
  assignments: Partial<Record<HospitalityRoleKey, string>>;
};

export type HospitalityWeekGroup = {
  key: string;
  label: string;
  rows: HospitalityPlanningRow[];
};

export const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export const DEFAULT_OPTIONAL_ROLES: HospitalityOptionalRoles = {
  microphoneThree: false,
  attendantExtra: false,
};

export const buildCommonRoles = (
  optionalRoles: HospitalityOptionalRoles
): HospitalityRoleKey[] => [
  'chairman',
  'microphoneOne',
  'microphoneTwo',
  ...(optionalRoles.microphoneThree ? (['microphoneThree'] as const) : []),
  'attendantDoor',
  'attendantAuditorium',
  ...(optionalRoles.attendantExtra ? (['attendantExtra'] as const) : []),
  'audioVideo',
];

export const rolesForMeetingType = (
  meetingType: HospitalityMeetingType,
  optionalRoles: HospitalityOptionalRoles = DEFAULT_OPTIONAL_ROLES
): HospitalityRoleKey[] => {
  const commonRoles = buildCommonRoles(optionalRoles);
  return meetingType === 'midweek'
    ? [...commonRoles, 'midweekBibleStudyReader']
    : [...commonRoles, 'watchtowerReader'];
};

const todayKey = (): string => formatDateKey(new Date());

/**
 * La ventana operativa admite maximo 2 meses calendario y 62 dias.
 * El ultimo dia del mes siguiente al de inicio cumple siempre ambas reglas
 * (peor caso: 1-jul -> 31-ago = 62 dias exactos).
 */
const defaultEndDateKey = (startKey: string): string => {
  const start = parseDateKey(startKey) ?? new Date();
  return formatDateKey(new Date(start.getFullYear(), start.getMonth() + 2, 0));
};

const toDate = (value: unknown): Date => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
};

const getMeetingType = (meeting: Meeting): HospitalityMeetingType =>
  meeting.type === 'midweek' || meeting.meetingCategory === 'midweek' ? 'midweek' : 'weekend';

const getMostFrequentMeetingDay = (
  meetings: Meeting[],
  meetingType: HospitalityMeetingType,
  fallback: number
): number => {
  const counts = new Map<number, number>();
  meetings
    .filter((meeting) => getMeetingType(meeting) === meetingType)
    .forEach((meeting) => {
      const day = toDate(meeting.meetingDate ?? meeting.startDate).getDay();
      counts.set(day, (counts.get(day) ?? 0) + 1);
    });

  return Array.from(counts.entries()).reduce(
    (mostFrequent, current) => current[1] > mostFrequent[1] ? current : mostFrequent,
    [fallback, 0]
  )[0];
};

export const buildRowsFromMeetings = (
  meetings: Meeting[],
  items: HospitalityScheduleItem[] = [],
  optionalRoles: HospitalityOptionalRoles = DEFAULT_OPTIONAL_ROLES
): HospitalityPlanningRow[] => {
  const selectedByKey = new Map(
    items.filter((item) => item.status === 'scheduled').map((item) => [
      item.meetingId
        ? `${item.meetingId}-${item.roleKey}`
        : `${item.meetingDate}-${item.meetingType}-${item.roleKey}`,
      item.userId,
    ])
  );

  return meetings.map((meeting) => {
    const meetingType = getMeetingType(meeting);
    const meetingDate = formatDateKey(toDate(meeting.meetingDate ?? meeting.startDate));
    const assignments: Partial<Record<HospitalityRoleKey, string>> = {};

    rolesForMeetingType(meetingType, optionalRoles).forEach((roleKey) => {
      assignments[roleKey] = selectedByKey.get(`${meeting.id}-${roleKey}`)
        ?? selectedByKey.get(`${meetingDate}-${meetingType}-${roleKey}`);
    });

    return {
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      meetingDate,
      meetingType,
      assignments,
    };
  });
};

export const buildItemsFromRows = (params: {
  rows: HospitalityPlanningRow[];
  optionalRoles: HospitalityOptionalRoles;
}): SaveHospitalityScheduleDraftItem[] =>
  params.rows.flatMap((row) =>
    rolesForMeetingType(row.meetingType, params.optionalRoles).flatMap((roleKey) => {
      const userId = row.assignments[roleKey];
      if (!userId) return [];

      return [{
        meetingId: row.meetingId,
        meetingDate: row.meetingDate,
        meetingType: row.meetingType,
        roleKey,
        userId,
      }];
    })
  );

export const selectInitialHospitalitySchedule = (
  schedules: HospitalitySchedule[],
  today = todayKey()
): HospitalitySchedule | null => {
  const inCurrentRange = schedules.filter(
    (schedule) => schedule.startDate <= today && schedule.endDate >= today
  );
  const recency = (schedule: HospitalitySchedule): number =>
    typeof schedule.createdAt?.toMillis === 'function'
      ? schedule.createdAt.toMillis()
      : Date.parse(schedule.startDate);
  return inCurrentRange
    .filter((schedule) => schedule.status === 'published')
    .sort((left, right) => recency(right) - recency(left))[0]
    ?? inCurrentRange
      .filter((schedule) => schedule.status === 'draft')
      .sort((left, right) => recency(right) - recency(left))[0]
    ?? null;
};

const compactDate = (dateKey: string, locale: string): string => {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;
  const value = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date).replace(/\./g, '');
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const weekLabel = (dateKey: string, locale: string): string => {
  const range = getWeekRangeForDate(dateKey);
  const start = parseDateKey(range.weekStartDate);
  const end = parseDateKey(range.weekEndDate);
  if (!start || !end) return dateKey;
  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = start.toLocaleDateString(locale, { month: 'short' }).replace('.', '');
  const endMonth = end.toLocaleDateString(locale, { month: 'short' }).replace('.', '');
  return startMonth === endMonth
    ? `${startDay}–${endDay} ${endMonth}`
    : `${startDay} ${startMonth}–${endDay} ${endMonth}`;
};

export const groupRowsByWeek = (
  rows: HospitalityPlanningRow[],
  locale = 'es-MX' /* default locale */
): HospitalityWeekGroup[] => {
  const groups = new Map<string, HospitalityPlanningRow[]>();
  rows.forEach((row) => {
    const key = getWeekRangeForDate(row.meetingDate).weekStartDate;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });
  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, groupedRows]) => ({ key, label: weekLabel(key, locale), rows: groupedRows }));
};

type PickerTarget = { rowId: string; roleKey: HospitalityRoleKey } | null;
type SaveDraftOutcome = {
  schedule: HospitalitySchedule;
  droppedItems: DroppedHospitalityScheduleItem[];
};

export function useHospitalityScheduleBuilder() {
  const { appUser, congregationId, uid, loadingProfile, profileError } = useUser();
  const { locale, t } = useI18n();
  const canEdit = canEditHospitalityAssignments(appUser);
  const canPublish = canManageHospitalityMicrophones(appUser);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [generatingMeetings, setGeneratingMeetings] = useState(false);
  const [substituting, setSubstituting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<ActiveCongregationUser[]>([]);
  const [schedules, setSchedules] = useState<HospitalitySchedule[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<HospitalitySchedule | null>(null);
  const [title, setTitle] = useState(t('hospitality.scheduleTitle'));
  const [startDate, setStartDate] = useState(todayKey());
  const [endDate, setEndDate] = useState(defaultEndDateKey(todayKey()));
  const [midweekDay, setMidweekDay] = useState(3);
  const [weekendDay, setWeekendDay] = useState(0);
  const [optionalRoles, setOptionalRoles] = useState<HospitalityOptionalRoles>(DEFAULT_OPTIONAL_ROLES);
  const [rows, setRows] = useState<HospitalityPlanningRow[]>([]);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [outgoingByDate, setOutgoingByDate] = useState<Record<string, Set<string>>>({});
  const loadedScopeRef = useRef<string | null>(null);

  const usersById = useMemo(() => new Map(users.map((user) => [user.uid, user])), [users]);
  const isPublishedView = selectedSchedule?.status === 'published';

  const loadSchedules = useCallback(async (): Promise<HospitalitySchedule[]> => {
    if (!congregationId) return [];
    const loadedSchedules = await getHospitalitySchedules(congregationId, {
      canManage: canPublish,
    });
    setSchedules(loadedSchedules);
    return loadedSchedules;
  }, [canPublish, congregationId]);

  const loadRows = useCallback(async (params?: {
    rangeStart?: string;
    rangeEnd?: string;
    schedule?: HospitalitySchedule | null;
    optionalRoles?: HospitalityOptionalRoles;
  }) => {
    if (!congregationId) return;
    const rangeStart = params?.rangeStart ?? startDate;
    const rangeEnd = params?.rangeEnd ?? endDate;
    const effectiveOptionalRoles = params?.optionalRoles ?? optionalRoles;
    const parsedStart = parseDateKey(rangeStart);
    const parsedEnd = parseDateKey(rangeEnd);
    if (!parsedStart || !parsedEnd || parsedStart > parsedEnd) {
      showAlert(t('hospitality.scheduleInvalidRangeTitle'), t('hospitality.scheduleInvalidRangeMsg'));
      return;
    }
    parsedStart.setHours(0, 0, 0, 0);
    parsedEnd.setHours(23, 59, 59, 999);
    setLoading(true);
    setError(null);
    try {
      const [loadedMeetings, loadedItems, outgoingTalks] = await Promise.all([
        getMeetingsByWeek(congregationId, parsedStart, parsedEnd, {
          includeMidweek: true,
          publicationStatus: 'all',
          forceServer: true,
          maxItems: 120,
        }),
        params?.schedule
          ? getHospitalityScheduleItems({ congregationId, scheduleId: params.schedule.id })
          : Promise.resolve([]),
        getScheduledOutgoingTalksInRange(congregationId, rangeStart, rangeEnd),
      ]);
      const nextRows = buildRowsFromMeetings(loadedMeetings, loadedItems, effectiveOptionalRoles);
      const nextOutgoing: Record<string, Set<string>> = {};
      nextRows.filter((row) => row.meetingType === 'weekend').forEach((row) => {
        nextOutgoing[row.meetingDate] = new Set(
          outgoingTalks
            .filter((talk) => row.meetingDate >= talk.weekStartDate && row.meetingDate <= talk.weekEndDate)
            .map((talk) => talk.speakerUserId)
        );
      });
      setRows(nextRows);
      setOutgoingByDate(nextOutgoing);
      setMidweekDay(getMostFrequentMeetingDay(loadedMeetings, 'midweek', 3));
      setWeekendDay(getMostFrequentMeetingDay(loadedMeetings, 'weekend', 0));
    } catch (requestError) {
      setError(formatFirestoreError(requestError));
    } finally {
      setLoading(false);
    }
  }, [congregationId, endDate, optionalRoles, startDate, t]);

  const openSchedule = useCallback(async (schedule: HospitalitySchedule) => {
    const restoredOptionalRoles = schedule.optionalRoles ?? DEFAULT_OPTIONAL_ROLES;
    setSelectedSchedule(schedule);
    setTitle(schedule.title);
    setStartDate(schedule.startDate);
    setEndDate(schedule.endDate);
    setOptionalRoles(restoredOptionalRoles);
    await loadRows({
      rangeStart: schedule.startDate,
      rangeEnd: schedule.endDate,
      schedule,
      optionalRoles: restoredOptionalRoles,
    });
  }, [loadRows]);

  const loadInitial = useCallback(async () => {
    if (!congregationId || !canEdit) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [loadedUsers, loadedSchedules] = await Promise.all([
        getActiveCongregationUsers(congregationId),
        loadSchedules(),
      ]);
      setUsers(loadedUsers);
      const initialSchedule = selectInitialHospitalitySchedule(loadedSchedules);
      if (initialSchedule) {
        await openSchedule(initialSchedule);
      } else {
        await loadRows();
      }
    } catch (requestError) {
      setError(formatFirestoreError(requestError));
    } finally {
      setLoading(false);
    }
  }, [canEdit, congregationId, loadRows, loadSchedules, openSchedule]);

  useEffect(() => {
    const scope = canEdit && congregationId ? congregationId : 'unavailable';
    if (loadedScopeRef.current === scope) return;
    loadedScopeRef.current = scope;
    void loadInitial();
  }, [canEdit, congregationId, loadInitial]);

  const setRoleUser = useCallback((rowId: string, roleKey: HospitalityRoleKey, userId?: string) => {
    setRows((current) => current.map((row) => row.meetingId === rowId
      ? { ...row, assignments: { ...row.assignments, [roleKey]: userId } }
      : row));
  }, []);

  const saveDraft = useCallback(async (): Promise<SaveDraftOutcome> => {
    if (!congregationId || !uid) throw new Error(t('dashboard.noCongregation'));
    const parsedStart = parseDateKey(startDate);
    const parsedEnd = parseDateKey(endDate);
    if (!parsedStart || !parsedEnd || parsedStart > parsedEnd) {
      throw new Error(t('hospitality.scheduleInvalidRangeMsg'));
    }
    const items = buildItemsFromRows({
      rows,
      optionalRoles,
    });
    if (items.length === 0) throw new Error(t('hospitality.scheduleRequireAssignment'));
    const result = await saveHospitalityScheduleDraft({
      congregationId,
      scheduleId: selectedSchedule?.status === 'draft' ? selectedSchedule.id : undefined,
      title,
      startDate,
      endDate,
      optionalRoles,
      items,
    });
    const fallbackSchedule: HospitalitySchedule = {
      ...(selectedSchedule?.id === result.scheduleId ? selectedSchedule : {
        id: result.scheduleId,
        congregationId,
        monthIds: [],
        status: 'draft' as const,
        createdBy: uid,
        createdAt: undefined as never,
        updatedAt: undefined as never,
      }),
      id: result.scheduleId,
      congregationId,
      title: title.trim(),
      startDate,
      endDate,
      totalMeetings: new Set(items.map((item) => item.meetingId)).size,
      status: 'draft',
      updatedBy: uid,
      optionalRoles,
    };
    const loadedSchedules = await loadSchedules();
    const schedule = loadedSchedules.find((item) => item.id === result.scheduleId)
      ?? fallbackSchedule;
    setSelectedSchedule(schedule);
    return { schedule, droppedItems: result.droppedItems };
  }, [congregationId, endDate, loadSchedules, optionalRoles, rows, selectedSchedule, startDate, t, title, uid]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const result = await saveDraft();
      await loadRows({
        rangeStart: result.schedule.startDate,
        rangeEnd: result.schedule.endDate,
        schedule: result.schedule,
        optionalRoles: result.schedule.optionalRoles ?? optionalRoles,
      });
      if (result.droppedItems.length > 0) {
        const details = result.droppedItems.map((item) => {
          const roleKey = item.roleKey as HospitalityRoleKey;
          return `${item.meetingDate} · ${t(`hospitality.roles.${roleKey}`)} · ${item.reason}`;
        }).join('\n');
        showAlert(t('hospitality.scheduleDroppedTitle'), t('hospitality.scheduleDroppedMsg', {
          count: result.droppedItems.length,
          details,
        }));
      } else {
        showAlert(t('hospitality.scheduleDraftSavedTitle'), t('hospitality.scheduleDraftSavedMsg'));
      }
    } catch (requestError) {
      showAlert(t('hospitality.scheduleSaveFailed'), formatFirestoreError(requestError));
    } finally {
      setSaving(false);
    }
  }, [loadRows, optionalRoles, saveDraft, t]);

  const handleGenerateMeetings = useCallback(async () => {
    if (!congregationId) return;
    setGeneratingMeetings(true);
    try {
      const result = await ensurePlanningMeetings({ congregationId, startDate, endDate, midweekDay, weekendDay });
      await loadRows();
      showAlert(t('hospitality.scheduleGeneratedTitle'), t('hospitality.scheduleGeneratedMsg', {
        created: result.createdMidweek + result.createdWeekend,
        existing: result.existing,
      }));
    } catch (requestError) {
      showAlert(t('hospitality.scheduleGenerateFailed'), formatFirestoreError(requestError));
    } finally {
      setGeneratingMeetings(false);
    }
  }, [congregationId, endDate, loadRows, midweekDay, startDate, t, weekendDay]);

  const publishNow = useCallback(async () => {
    if (!congregationId || !uid) return;
    setPublishing(true);
    try {
      const draftResult = await saveDraft();
      if (draftResult.droppedItems.length > 0) {
        const details = draftResult.droppedItems.map((item) => {
          const roleKey = item.roleKey as HospitalityRoleKey;
          return `${item.meetingDate} · ${t(`hospitality.roles.${roleKey}`)} · ${item.reason}`;
        }).join('\n');
        showAlert(t('hospitality.scheduleDroppedTitle'), t('hospitality.scheduleDroppedMsg', {
          count: draftResult.droppedItems.length,
          details,
        }));
        return;
      }
      const { schedule } = draftResult;
      const result = await publishHospitalitySchedule({
        congregationId,
        scheduleId: schedule.id,
        actorUid: uid,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        syncMeetings: true,
      });
      const publishedSchedule = { ...schedule, status: 'published' as const };
      setSelectedSchedule(publishedSchedule);
      await loadSchedules();
      await loadRows({
        rangeStart: schedule.startDate,
        rangeEnd: schedule.endDate,
        schedule: publishedSchedule,
        optionalRoles: schedule.optionalRoles ?? optionalRoles,
      });
      showAlert(t('hospitality.schedulePublishedTitle'), t(
        result.missingMeetings > 0
          ? 'hospitality.schedulePublishedMissingMsg'
          : 'hospitality.schedulePublishedMsg',
        { synced: result.syncedMeetings, missing: result.missingMeetings }
      ));
    } catch (requestError) {
      showAlert(t('hospitality.schedulePublishFailed'), formatFirestoreError(requestError));
    } finally {
      setPublishing(false);
    }
  }, [congregationId, loadRows, loadSchedules, optionalRoles, saveDraft, t, uid]);

  const rowProgress = useCallback((row: HospitalityPlanningRow) => {
    const roles = rolesForMeetingType(row.meetingType, optionalRoles);
    return { assigned: roles.filter((role) => Boolean(row.assignments[role])).length, total: roles.length };
  }, [optionalRoles]);

  const completeMeetings = useMemo(
    () => rows.filter((row) => { const progress = rowProgress(row); return progress.total > 0 && progress.assigned === progress.total; }).length,
    [rowProgress, rows]
  );
  const missingAssignments = useMemo(
    () => rows.reduce((total, row) => { const progress = rowProgress(row); return total + progress.total - progress.assigned; }, 0),
    [rowProgress, rows]
  );
  const windowValidation = useMemo(() => {
    const parsedStart = parseDateKey(startDate);
    const parsedEnd = parseDateKey(endDate);
    if (!parsedStart || !parsedEnd) {
      return { ok: false, errors: [t('hospitality.scheduleInvalidRangeMsg')] };
    }
    const result = validatePlanningWindow({
      startDate: parsedStart,
      endDate: parsedEnd,
      module: 'hospitalityMicrophones',
    });
    return { ok: result.ok, errors: result.errors };
  }, [endDate, startDate, t]);

  const canPublishSchedule = canPublish
    && rows.length > 0
    && missingAssignments === 0
    && !isPublishedView
    && windowValidation.ok;

  const requestPublish = useCallback(async () => {
    if (!canPublishSchedule) return;
    const confirmed = await confirmAlert({
      title: t('hospitality.publishConfirmTitle'),
      message: t('hospitality.publishConfirmMessage'),
      confirmLabel: t('hospitality.schedulePublish'),
      cancelLabel: t('common.cancel'),
    });
    if (!confirmed) return;
    await publishNow();
  }, [canPublishSchedule, publishNow, t]);

  const pickerRow = pickerTarget ? rows.find((row) => row.meetingId === pickerTarget.rowId) : undefined;
  const pickerSelectedUserId = pickerRow && pickerTarget ? pickerRow.assignments[pickerTarget.roleKey] : undefined;
  const pickerDisabledReasons = useMemo(() => {
    if (!pickerRow || !pickerTarget) return {} as Record<string, string>;
    const reasons: Record<string, string> = {};
    Object.entries(pickerRow.assignments).forEach(([role, userId]) => {
      if (userId && role !== pickerTarget.roleKey && userId !== pickerSelectedUserId) {
        reasons[userId] = t('hospitality.conflictSameMeeting');
      }
    });
    if (pickerRow.meetingType === 'weekend') {
      outgoingByDate[pickerRow.meetingDate]?.forEach((userId) => {
        if (userId !== pickerSelectedUserId) reasons[userId] = t('hospitality.substituteOutgoingSpeaker');
      });
    }
    return reasons;
  }, [outgoingByDate, pickerRow, pickerSelectedUserId, pickerTarget, t]);

  const cellConflict = useCallback((row: HospitalityPlanningRow, roleKey: HospitalityRoleKey): string | undefined => {
    const userId = row.assignments[roleKey];
    if (!userId) return undefined;
    const duplicated = Object.entries(row.assignments).some(([otherRole, otherUserId]) =>
      otherRole !== roleKey && otherUserId === userId
    );
    if (duplicated) return t('hospitality.conflictSameMeeting');
    if (row.meetingType === 'weekend' && outgoingByDate[row.meetingDate]?.has(userId)) {
      return t('hospitality.substituteOutgoingSpeaker');
    }
    return undefined;
  }, [outgoingByDate, t]);

  const confirmSubstitution = useCallback(async (row: HospitalityPlanningRow, roleKey: HospitalityRoleKey, nextUser: ActiveCongregationUser) => {
    if (!congregationId || !selectedSchedule) return;
    const currentUserId = row.assignments[roleKey];
    const confirmed = await confirmAlert({
      title: t('hospitality.substituteConfirmTitle'),
      message: t('hospitality.substituteConfirmMsg', {
        current: currentUserId ? usersById.get(currentUserId)?.displayName ?? t('hospitality.scheduleUnassigned') : t('hospitality.scheduleUnassigned'),
        next: nextUser.displayName,
        role: t(`hospitality.roles.${roleKey}`),
        date: row.meetingDate,
      }),
      confirmLabel: t('hospitality.substituteConfirmAction'),
      cancelLabel: t('common.cancel'),
    });
    if (!confirmed) return;
    setSubstituting(true);
    try {
      await substituteHospitalityAssignment({
        congregationId,
        scheduleId: selectedSchedule.id,
        itemId: `${row.meetingId}-${roleKey}`,
        newUserId: nextUser.uid,
      });
      await loadRows({
        rangeStart: selectedSchedule.startDate,
        rangeEnd: selectedSchedule.endDate,
        schedule: selectedSchedule,
        optionalRoles,
      });
      showAlert(t('hospitality.substituteSuccessTitle'), t('hospitality.substituteSuccessMsg'));
    } catch (requestError) {
      showAlert(t('hospitality.substituteFailed'), formatFirestoreError(requestError));
    } finally {
      setSubstituting(false);
    }
  }, [congregationId, loadRows, optionalRoles, selectedSchedule, t, usersById]);

  const selectPickerUser = useCallback((user?: ActiveCongregationUser) => {
    if (!pickerRow || !pickerTarget) return;
    setPickerTarget(null);
    if (user?.uid === pickerSelectedUserId) return;
    if (isPublishedView) {
      if (user) void confirmSubstitution(pickerRow, pickerTarget.roleKey, user);
      return;
    }
    setRoleUser(pickerRow.meetingId, pickerTarget.roleKey, user?.uid);
  }, [confirmSubstitution, isPublishedView, pickerRow, pickerSelectedUserId, pickerTarget, setRoleUser]);

  const handleArchiveSchedule = useCallback(async (schedule: HospitalitySchedule) => {
    if (!congregationId) return;
    setArchiving(true);
    try {
      const result = await archiveHospitalitySchedule({
        congregationId,
        scheduleId: schedule.id,
      });
      const loadedSchedules = await loadSchedules();
      if (selectedSchedule?.id === schedule.id) {
        const nextSchedule = selectInitialHospitalitySchedule(loadedSchedules);
        if (nextSchedule) {
          await openSchedule(nextSchedule);
        } else {
          setSelectedSchedule(null);
          setRows([]);
        }
      }
      showAlert(t('hospitality.scheduleArchivedTitle'), t('hospitality.scheduleArchivedMsg', {
        count: result.cancelledItems,
      }));
    } catch (requestError) {
      showAlert(t('hospitality.scheduleArchiveFailed'), formatFirestoreError(requestError));
    } finally {
      setArchiving(false);
    }
  }, [congregationId, loadSchedules, openSchedule, selectedSchedule, t]);

  return {
    auth: { canEdit, canPublish, congregationId, loadingProfile, profileError },
    state: { loading, saving, publishing, generatingMeetings, substituting, archiving, error, isPublishedView },
    setup: {
      title, setTitle, startDate, setStartDate, endDate, setEndDate,
      midweekDay, setMidweekDay, weekendDay, setWeekendDay,
      optionalRoles, setOptionalRoles,
    },
    schedules,
    selectedSchedule,
    rows,
    weekGroups: groupRowsByWeek(rows, locale),
    users,
    usersById,
    progress: { completeMeetings, totalMeetings: rows.length, missingAssignments, canPublish: canPublishSchedule, windowErrors: windowValidation.errors, rowProgress },
    picker: {
      visible: Boolean(pickerTarget),
      roleKey: pickerTarget?.roleKey,
      row: pickerRow,
      selectedUserId: pickerSelectedUserId,
      disabledReasons: pickerDisabledReasons,
      open: (row: HospitalityPlanningRow, roleKey: HospitalityRoleKey) => {
        if (isPublishedView && !canPublish) return;
        setPickerTarget({ rowId: row.meetingId, roleKey });
      },
      close: () => setPickerTarget(null),
      select: selectPickerUser,
    },
    actions: {
      reload: loadInitial,
      loadRows,
      openSchedule,
      save: handleSave,
      publish: () => void requestPublish(),
      generateMeetings: handleGenerateMeetings,
      archiveSchedule: (schedule: HospitalitySchedule) => void handleArchiveSchedule(schedule),
    },
    helpers: { compactDate: (dateKey: string) => compactDate(dateKey, locale), cellConflict },
    t,
  };
}
