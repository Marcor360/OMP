import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { EmptyState } from '@/src/components/common/EmptyState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { DatePickerModal } from '@/src/components/forms/DatePickerModal';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useI18n } from '@/src/i18n/index';
import {
  getCleaningGroups,
} from '@/src/modules/cleaning/services/cleaning-service';
import { CleaningGroup } from '@/src/modules/cleaning/types/cleaning-group.types';
import { useUser } from '@/src/context/user-context';
import {
  createCleaningSchedule,
  getCleaningScheduleItems,
  getCleaningSchedules,
  publishCleaningSchedule,
  saveCleaningScheduleItems,
} from '@/src/services/cleaning/cleaning-schedule-service';
import { getMeetingsByWeek } from '@/src/services/meetings/meetings-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import {
  CleaningSchedule,
  CleaningScheduleItem,
  CleaningScheduleMeetingType,
} from '@/src/types/cleaning-schedule';
import { Meeting } from '@/src/types/meeting';
import { formatDateKey, parseDateKey } from '@/src/utils/dates/date-key';
import { getOperationalDateBounds } from '@/src/utils/dates/operational-window';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { showAlert } from '@/src/utils/ui/alerts';
import { canManageCleaning } from '@/src/utils/permissions/permissions';

type CleaningPlanningRow = {
  meetingId: string;
  meetingTitle: string;
  meetingDate: string;
  meetingType: CleaningScheduleMeetingType;
  cleaningGroupId?: string;
};

type DatePickerTarget = 'start' | 'end' | null;

const todayKey = (): string => formatDateKey(new Date());

const addDaysKey = (dateKey: string, days: number): string => {
  const date = parseDateKey(dateKey) ?? new Date();
  date.setDate(date.getDate() + days);
  return formatDateKey(date);
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

const getMeetingType = (meeting: Meeting): CleaningScheduleMeetingType =>
  meeting.type === 'midweek' || meeting.meetingCategory === 'midweek' ? 'midweek' : 'weekend';

const buildRowsFromMeetings = (
  meetings: Meeting[],
  items: CleaningScheduleItem[] = []
): CleaningPlanningRow[] => {
  const selectedByKey = new Map(
    items.map((item) => [`${item.meetingDate}-${item.meetingType}`, item.cleaningGroupId])
  );

  return meetings.map((meeting) => {
    const meetingType = getMeetingType(meeting);
    const meetingDate = formatDateKey(toDate(meeting.meetingDate ?? meeting.startDate));

    return {
      meetingId: meeting.id,
      meetingTitle: meeting.title,
      meetingDate,
      meetingType,
      cleaningGroupId: selectedByKey.get(`${meetingDate}-${meetingType}`),
    };
  });
};

const buildItemsFromRows = (params: {
  congregationId: string;
  scheduleId: string;
  rows: CleaningPlanningRow[];
  groupsById: Map<string, CleaningGroup>;
  actorUid: string;
}): Omit<CleaningScheduleItem, 'id' | 'createdAt' | 'updatedAt'>[] =>
  params.rows.flatMap((row) => {
    if (!row.cleaningGroupId) return [];
    const group = params.groupsById.get(row.cleaningGroupId);
    if (!group) return [];

    return [{
      congregationId: params.congregationId,
      scheduleId: params.scheduleId,
      meetingId: row.meetingId,
      meetingDate: row.meetingDate,
      meetingType: row.meetingType,
      cleaningGroupId: group.id,
      cleaningGroupName: group.name,
      status: 'scheduled' as const,
      createdBy: params.actorUid,
      updatedBy: params.actorUid,
    }];
  });

export function CleaningScheduleScreen() {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { appUser, congregationId, uid, loadingProfile, profileError } = useUser();
  const { t } = useI18n();
  const canManage = canManageCleaning(appUser);
  const operationalBounds = useMemo(() => getOperationalDateBounds(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<CleaningGroup[]>([]);
  const [schedules, setSchedules] = useState<CleaningSchedule[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<CleaningSchedule | null>(null);
  const [title, setTitle] = useState(t('cleaning.scheduleTitle'));
  const [startDate, setStartDate] = useState(todayKey());
  const [endDate, setEndDate] = useState(addDaysKey(todayKey(), 45));
  const [datePickerTarget, setDatePickerTarget] = useState<DatePickerTarget>(null);
  const [rows, setRows] = useState<CleaningPlanningRow[]>([]);
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null);

  const activeGroups = useMemo(
    () => groups.filter((group) => group.isActive),
    [groups]
  );
  const groupsById = useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups]
  );

  const loadSchedules = useCallback(async () => {
    if (!congregationId) return;
    const loadedSchedules = await getCleaningSchedules(congregationId);
    setSchedules(loadedSchedules);
  }, [congregationId]);

  const loadRows = useCallback(
    async (params?: {
      rangeStart?: string;
      rangeEnd?: string;
      schedule?: CleaningSchedule | null;
    }) => {
      if (!congregationId) return;

      const rangeStart = params?.rangeStart ?? startDate;
      const rangeEnd = params?.rangeEnd ?? endDate;
      const parsedStart = parseDateKey(rangeStart);
      const parsedEnd = parseDateKey(rangeEnd);
      if (!parsedStart || !parsedEnd || parsedStart > parsedEnd) {
        showAlert(t('cleaning.scheduleInvalidRangeTitle'), t('cleaning.scheduleInvalidRangeMsg'));
        return;
      }

      parsedStart.setHours(0, 0, 0, 0);
      parsedEnd.setHours(23, 59, 59, 999);

      setLoading(true);
      setError(null);

      try {
        const [loadedMeetings, loadedItems] = await Promise.all([
          getMeetingsByWeek(congregationId, parsedStart, parsedEnd, {
            includeMidweek: true,
            publicationStatus: 'all',
            forceServer: true,
            maxItems: 120,
          }),
          params?.schedule
            ? getCleaningScheduleItems({
                congregationId,
                scheduleId: params.schedule.id,
              })
            : Promise.resolve([]),
        ]);

        setRows(buildRowsFromMeetings(loadedMeetings, loadedItems));
      } catch (requestError) {
        setError(formatFirestoreError(requestError));
      } finally {
        setLoading(false);
      }
    },
    [congregationId, endDate, startDate, t]
  );

  const loadInitial = useCallback(async () => {
    if (!congregationId || !canManage) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const loadedGroups = await getCleaningGroups(congregationId);
      setGroups(loadedGroups);
      await Promise.all([loadSchedules(), loadRows()]);
    } catch (requestError) {
      setError(formatFirestoreError(requestError));
    } finally {
      setLoading(false);
    }
  }, [canManage, congregationId, loadRows, loadSchedules]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const openSchedule = useCallback(
    async (schedule: CleaningSchedule) => {
      setSelectedSchedule(schedule);
      setTitle(schedule.title);
      setStartDate(schedule.startDate);
      setEndDate(schedule.endDate);
      await loadRows({
        rangeStart: schedule.startDate,
        rangeEnd: schedule.endDate,
        schedule,
      });
    },
    [loadRows]
  );

  const setRowGroup = useCallback((meetingId: string, cleaningGroupId: string | undefined) => {
    setRows((current) =>
      current.map((row) =>
        row.meetingId === meetingId
          ? {
              ...row,
              cleaningGroupId,
            }
          : row
      )
    );
  }, []);

  const saveDraft = useCallback(async (): Promise<CleaningSchedule> => {
    if (!congregationId || !uid) {
      throw new Error(t('dashboard.noCongregation'));
    }

    const parsedStart = parseDateKey(startDate);
    const parsedEnd = parseDateKey(endDate);
    if (!parsedStart || !parsedEnd || parsedStart > parsedEnd) {
      throw new Error(t('cleaning.scheduleInvalidRangeMsg'));
    }

    const scheduleId =
      selectedSchedule?.id ??
      await createCleaningSchedule({
        congregationId,
        title,
        startDate: parsedStart,
        endDate: parsedEnd,
        totalMeetings: rows.length,
        actorUid: uid,
      });

    const schedule: CleaningSchedule = selectedSchedule ?? {
      id: scheduleId,
      congregationId,
      title,
      startDate,
      endDate,
      monthIds: [],
      totalMeetings: rows.length,
      status: 'draft',
      createdBy: uid,
      updatedBy: uid,
      createdAt: undefined as never,
      updatedAt: undefined as never,
    };

    const items = buildItemsFromRows({
      congregationId,
      scheduleId,
      rows,
      groupsById,
      actorUid: uid,
    });

    if (items.length === 0) {
      throw new Error(t('cleaning.scheduleRequireGroup'));
    }

    await saveCleaningScheduleItems({
      congregationId,
      scheduleId,
      items,
      actorUid: uid,
    });

    setSelectedSchedule(schedule);
    await loadSchedules();
    return schedule;
  }, [
    congregationId,
    endDate,
    groupsById,
    loadSchedules,
    rows,
    selectedSchedule,
    startDate,
    title,
    t,
    uid,
  ]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveDraft();
      showAlert(t('cleaning.scheduleDraftSavedTitle'), t('cleaning.scheduleDraftSavedMsg'));
    } catch (requestError) {
      showAlert(t('cleaning.scheduleSaveFailed'), formatFirestoreError(requestError));
    } finally {
      setSaving(false);
    }
  }, [saveDraft, t]);

  const handlePublish = useCallback(async () => {
    if (!congregationId || !uid) return;

    setPublishing(true);
    try {
      const schedule = await saveDraft();
      const result = await publishCleaningSchedule({
        congregationId,
        scheduleId: schedule.id,
        actorUid: uid,
        startDate,
        endDate,
        syncMeetings: true,
      });
      await loadSchedules();
      showAlert(
        t('cleaning.schedulePublishedTitle'),
        t('cleaning.schedulePublishedMsg', { synced: result.syncedMeetings, missing: result.missingMeetings })
      );
    } catch (requestError) {
      showAlert(t('cleaning.schedulePublishFailed'), formatFirestoreError(requestError));
    } finally {
      setPublishing(false);
    }
  }, [congregationId, endDate, loadSchedules, saveDraft, startDate, uid, t]);

  if (loadingProfile || loading) {
    return <LoadingState message={t('cleaning.scheduleLoading')} />;
  }

  if (!congregationId) {
    return <ErrorState message={profileError ?? t('dashboard.noCongregation')} />;
  }

  if (!canManage) {
    return <ErrorState message={t('cleaning.scheduleNoPermission')} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void loadInitial()} />;
  }

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <PageHeader
        title={t('cleaning.scheduleTitle')}
        subtitle={t('cleaning.scheduleSubtitle')}
        showBack
        actions={
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => void loadRows()}
            accessibilityLabel="Recargar reuniones"
          >
            <Ionicons name="refresh-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        }
      />

      <FlatList
        data={rows}
        keyExtractor={(item) => item.meetingId}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.topStack}>
            <View style={styles.panel}>
              <ThemedText style={styles.sectionTitle}>{t('cleaning.scheduleWorkList')}</ThemedText>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder={t('cleaning.scheduleTitlePlaceholder')}
                placeholderTextColor={colors.textDisabled}
              />
              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={[styles.input, styles.dateInput]}
                  onPress={() => setDatePickerTarget('start')}
                  disabled={saving || publishing}
                >
                  <ThemedText style={styles.dateText}>{startDate}</ThemedText>
                  <Ionicons name="calendar-outline" size={17} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.input, styles.dateInput]}
                  onPress={() => setDatePickerTarget('end')}
                  disabled={saving || publishing}
                >
                  <ThemedText style={styles.dateText}>{endDate}</ThemedText>
                  <Ionicons name="calendar-outline" size={17} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => void loadRows()}
                  disabled={saving || publishing}
                >
                  <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                  <ThemedText style={styles.secondaryButtonText}>{t('cleaning.scheduleLoadMeetings')}</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleSave}
                  disabled={saving || publishing}
                >
                  <Ionicons name="save-outline" size={16} color={colors.primary} />
                  <ThemedText style={styles.secondaryButtonText}>
                    {saving ? t('cleaning.scheduleSaving') : t('cleaning.scheduleSave')}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handlePublish}
                  disabled={saving || publishing}
                >
                  <Ionicons name="cloud-upload-outline" size={16} color={colors.onPrimary} />
                  <ThemedText style={styles.primaryButtonText}>
                    {publishing ? t('cleaning.schedulePublishing') : t('cleaning.schedulePublish')}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            {schedules.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scheduleScroller}
              >
                {schedules.map((schedule) => (
                  <TouchableOpacity
                    key={schedule.id}
                    style={[
                      styles.scheduleChip,
                      selectedSchedule?.id === schedule.id && styles.scheduleChipSelected,
                    ]}
                    onPress={() => void openSchedule(schedule)}
                  >
                    <ThemedText style={styles.scheduleChipTitle} numberOfLines={1}>
                      {schedule.title}
                    </ThemedText>
                    <ThemedText style={styles.scheduleChipMeta}>
                      {schedule.startDate} - {schedule.endDate}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.scheduleChipStatus,
                        schedule.status === 'published' && styles.publishedText,
                      ]}
                    >
                      {schedule.status === 'published' ? t('cleaning.scheduleStatusPublished') : t('cleaning.scheduleStatusDraft')}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}

            <View style={styles.counterPill}>
              <View style={styles.counterDot} />
              <ThemedText style={styles.counterText}>
                {t(rows.length === 1 ? 'cleaning.scheduleMeetingsInRange' : 'cleaning.scheduleMeetingsInRange_plural', { count: rows.length })}
              </ThemedText>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const selectedGroup = item.cleaningGroupId ? groupsById.get(item.cleaningGroupId) : undefined;
          const expanded = expandedMeetingId === item.meetingId;

          return (
            <View style={styles.meetingCard}>
              <View style={styles.meetingHeader}>
                <View style={styles.meetingTitleWrap}>
                  <ThemedText style={styles.meetingTitle}>{item.meetingTitle}</ThemedText>
                  <ThemedText style={styles.meetingMeta}>
                    {item.meetingDate} · {item.meetingType === 'midweek' ? t('cleaning.scheduleMidweek') : t('cleaning.scheduleWeekend')}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.roleBlock}>
                <TouchableOpacity
                  style={styles.roleButton}
                  onPress={() => setExpandedMeetingId(expanded ? null : item.meetingId)}
                >
                  <View style={styles.roleTextWrap}>
                    <ThemedText style={styles.roleTitle}>{t('cleaning.scheduleAssignedGroup')}</ThemedText>
                    <ThemedText style={styles.roleUser}>
                      {selectedGroup?.name ?? t('cleaning.scheduleUnassigned')}
                    </ThemedText>
                  </View>
                  <Ionicons
                    name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                    size={18}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>

                {expanded ? (
                  <View style={styles.groupPicker}>
                    <TouchableOpacity
                      style={styles.groupOption}
                      onPress={() => {
                        setRowGroup(item.meetingId, undefined);
                        setExpandedMeetingId(null);
                      }}
                    >
                      <ThemedText style={styles.groupOptionName}>{t('cleaning.scheduleUnassigned')}</ThemedText>
                    </TouchableOpacity>
                    {activeGroups.map((group) => (
                      <TouchableOpacity
                        key={group.id}
                        style={styles.groupOption}
                        onPress={() => {
                          setRowGroup(item.meetingId, group.id);
                          setExpandedMeetingId(null);
                        }}
                      >
                        <ThemedText style={styles.groupOptionName}>{group.name}</ThemedText>
                        <ThemedText style={styles.groupOptionMeta}>
                          {t(group.memberCount === 1 ? 'cleaning.membersCount' : 'cleaning.membersCount_plural', { count: group.memberCount })}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <EmptyState
            icon="calendar-clear-outline"
            title={t('cleaning.scheduleEmptyTitle')}
            description={t('cleaning.scheduleEmptyDesc')}
          />
        }
        showsVerticalScrollIndicator={false}
      />
      <DatePickerModal
        visible={datePickerTarget !== null}
        selectedDate={datePickerTarget === 'end' ? endDate : startDate}
        minDate={datePickerTarget === 'end' ? startDate : operationalBounds.minDate}
        maxDate={operationalBounds.maxDate}
        onSelectDate={(date) => {
          if (datePickerTarget === 'start') {
            setStartDate(date);
            if (date > endDate) setEndDate(date);
          } else if (datePickerTarget === 'end') {
            setEndDate(date);
          }
        }}
        onClose={() => setDatePickerTarget(null)}
      />
    </ScreenContainer>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    content: {
      padding: 16,
      paddingBottom: 28,
    },
    topStack: {
      gap: 12,
      marginBottom: 12,
    },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.primary + '66',
      backgroundColor: colors.primary + '14',
    },
    panel: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 12,
      gap: 10,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.backgroundLight,
      color: colors.textPrimary,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
    },
    dateRow: {
      flexDirection: 'row',
      gap: 8,
    },
    dateInput: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    dateText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    formActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.primary + '66',
      backgroundColor: colors.primary + '14',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '800',
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontSize: 12,
      fontWeight: '800',
    },
    scheduleScroller: {
      gap: 8,
      paddingRight: 16,
    },
    scheduleChip: {
      width: 210,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 10,
      gap: 2,
    },
    scheduleChipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '12',
    },
    scheduleChipTitle: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    scheduleChipMeta: {
      color: colors.textMuted,
      fontSize: 11,
    },
    scheduleChipStatus: {
      color: colors.warning,
      fontSize: 11,
      fontWeight: '800',
    },
    publishedText: {
      color: colors.success,
    },
    counterPill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    counterDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    counterText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    separator: {
      height: 12,
    },
    meetingCard: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 12,
      gap: 10,
    },
    meetingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    meetingTitleWrap: {
      flex: 1,
      gap: 2,
    },
    meetingTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    meetingMeta: {
      color: colors.textMuted,
      fontSize: 12,
    },
    roleBlock: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundLight,
      borderRadius: 8,
      overflow: 'hidden',
    },
    roleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      padding: 10,
    },
    roleTextWrap: {
      flex: 1,
      gap: 2,
    },
    roleTitle: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    roleUser: {
      color: colors.textMuted,
      fontSize: 12,
    },
    groupPicker: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      maxHeight: 260,
    },
    groupOption: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    groupOptionName: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    groupOptionMeta: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 1,
    },
  });
