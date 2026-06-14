import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import {
  createHospitalitySchedule,
  getHospitalityScheduleItems,
  getHospitalitySchedules,
  publishHospitalitySchedule,
  saveHospitalityScheduleItems,
} from '@/src/services/hospitality-microphones/hospitality-microphones-service';
import { getMeetingsByWeek } from '@/src/services/meetings/meetings-service';
import {
  ActiveCongregationUser,
  getActiveCongregationUsers,
} from '@/src/services/users/active-users-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import {
  HospitalityMeetingType,
  HospitalityRoleKey,
  HospitalitySchedule,
  HospitalityScheduleItem,
} from '@/src/types/hospitality-microphones';
import { Meeting } from '@/src/types/meeting';
import { formatDateKey, parseDateKey } from '@/src/utils/dates/date-key';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { canManageHospitalityMicrophones } from '@/src/utils/permissions/permissions';

type PlanningRow = {
  meetingId: string;
  meetingTitle: string;
  meetingDate: string;
  meetingType: HospitalityMeetingType;
  assignments: Partial<Record<HospitalityRoleKey, string>>;
};

const ROLE_LABELS: Record<HospitalityRoleKey, string> = {
  microphoneOne: 'Microfono 1',
  microphoneTwo: 'Microfono 2',
  attendantDoor: 'Acomodador de puerta',
  attendantAuditorium: 'Acomodador de auditorio',
  watchtowerReader: 'Lector Atalaya',
  midweekBibleStudyReader: 'Lector estudio biblico',
  audioVideo: 'Audio y video',
};

const COMMON_ROLES: HospitalityRoleKey[] = [
  'microphoneOne',
  'microphoneTwo',
  'attendantDoor',
  'attendantAuditorium',
  'audioVideo',
];

const rolesForMeetingType = (meetingType: HospitalityMeetingType): HospitalityRoleKey[] =>
  meetingType === 'midweek'
    ? [...COMMON_ROLES, 'midweekBibleStudyReader']
    : [...COMMON_ROLES, 'watchtowerReader'];

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

const getMeetingType = (meeting: Meeting): HospitalityMeetingType =>
  meeting.type === 'midweek' || meeting.meetingCategory === 'midweek' ? 'midweek' : 'weekend';

const buildRowsFromMeetings = (
  meetings: Meeting[],
  items: HospitalityScheduleItem[] = []
): PlanningRow[] => {
  const selectedByKey = new Map(
    items.map((item) => [
      `${item.meetingDate}-${item.meetingType}-${item.roleKey}`,
      item.userId,
    ])
  );

  return meetings.map((meeting) => {
    const meetingType = getMeetingType(meeting);
    const meetingDate = formatDateKey(toDate(meeting.meetingDate ?? meeting.startDate));
    const assignments: Partial<Record<HospitalityRoleKey, string>> = {};

    rolesForMeetingType(meetingType).forEach((roleKey) => {
      assignments[roleKey] = selectedByKey.get(`${meetingDate}-${meetingType}-${roleKey}`);
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

const buildItemsFromRows = (params: {
  congregationId: string;
  scheduleId: string;
  rows: PlanningRow[];
  usersById: Map<string, ActiveCongregationUser>;
  actorUid: string;
}): Omit<HospitalityScheduleItem, 'id' | 'createdAt' | 'updatedAt'>[] =>
  params.rows.flatMap((row) =>
    rolesForMeetingType(row.meetingType).flatMap((roleKey) => {
      const userId = row.assignments[roleKey];
      const user = userId ? params.usersById.get(userId) : undefined;
      if (!user) return [];

      return [{
        congregationId: params.congregationId,
        scheduleId: params.scheduleId,
        meetingId: row.meetingId,
        meetingDate: row.meetingDate,
        meetingType: row.meetingType,
        roleKey,
        roleLabel: ROLE_LABELS[roleKey],
        userId: user.uid,
        userNameSnapshot: user.displayName,
        status: 'scheduled' as const,
        createdBy: params.actorUid,
        updatedBy: params.actorUid,
      }];
    })
  );

export function HospitalityMicrophonesScheduleScreen() {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { appUser, congregationId, uid, loadingProfile, profileError } = useUser();
  const canManage = canManageHospitalityMicrophones(appUser);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<ActiveCongregationUser[]>([]);
  const [schedules, setSchedules] = useState<HospitalitySchedule[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<HospitalitySchedule | null>(null);
  const [title, setTitle] = useState('Acomodadores y microfonos');
  const [startDate, setStartDate] = useState(todayKey());
  const [endDate, setEndDate] = useState(addDaysKey(todayKey(), 45));
  const [rows, setRows] = useState<PlanningRow[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const usersById = useMemo(
    () => new Map(users.map((user) => [user.uid, user])),
    [users]
  );

  const loadSchedules = useCallback(async () => {
    if (!congregationId) return;
    const loadedSchedules = await getHospitalitySchedules(congregationId);
    setSchedules(loadedSchedules);
  }, [congregationId]);

  const loadRows = useCallback(
    async (params?: {
      rangeStart?: string;
      rangeEnd?: string;
      schedule?: HospitalitySchedule | null;
    }) => {
      if (!congregationId) return;

      const rangeStart = params?.rangeStart ?? startDate;
      const rangeEnd = params?.rangeEnd ?? endDate;
      const parsedStart = parseDateKey(rangeStart);
      const parsedEnd = parseDateKey(rangeEnd);
      if (!parsedStart || !parsedEnd || parsedStart > parsedEnd) {
        Alert.alert('Rango invalido', 'Usa fechas validas en formato YYYY-MM-DD.');
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
            ? getHospitalityScheduleItems({
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
    [congregationId, endDate, startDate]
  );

  const loadInitial = useCallback(async () => {
    if (!congregationId || !canManage) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const loadedUsers = await getActiveCongregationUsers(congregationId);
      setUsers(loadedUsers);
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
    async (schedule: HospitalitySchedule) => {
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

  const setRoleUser = useCallback((
    rowKey: string,
    roleKey: HospitalityRoleKey,
    userId: string | undefined
  ) => {
    setRows((current) =>
      current.map((row) =>
        row.meetingId === rowKey
          ? {
              ...row,
              assignments: {
                ...row.assignments,
                [roleKey]: userId,
              },
            }
          : row
      )
    );
  }, []);

  const saveDraft = useCallback(async (): Promise<HospitalitySchedule> => {
    if (!congregationId || !uid) {
      throw new Error('No hay congregacion activa.');
    }

    const parsedStart = parseDateKey(startDate);
    const parsedEnd = parseDateKey(endDate);
    if (!parsedStart || !parsedEnd || parsedStart > parsedEnd) {
      throw new Error('Usa un rango valido en formato YYYY-MM-DD.');
    }

    const scheduleId =
      selectedSchedule?.id ??
      await createHospitalitySchedule({
        congregationId,
        title,
        startDate: parsedStart,
        endDate: parsedEnd,
        totalMeetings: rows.length,
        actorUid: uid,
      });

    const schedule: HospitalitySchedule = selectedSchedule ?? {
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
      usersById,
      actorUid: uid,
    });

    if (items.length === 0) {
      throw new Error('Asigna al menos una responsabilidad antes de guardar.');
    }

    await saveHospitalityScheduleItems({
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
    loadSchedules,
    rows,
    selectedSchedule,
    startDate,
    title,
    uid,
    usersById,
  ]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveDraft();
      Alert.alert('Borrador guardado', 'La lista quedo guardada correctamente.');
    } catch (requestError) {
      Alert.alert('No se pudo guardar', formatFirestoreError(requestError));
    } finally {
      setSaving(false);
    }
  }, [saveDraft]);

  const handlePublish = useCallback(async () => {
    if (!congregationId || !uid) return;

    setPublishing(true);
    try {
      const schedule = await saveDraft();
      const result = await publishHospitalitySchedule({
        congregationId,
        scheduleId: schedule.id,
        actorUid: uid,
        startDate,
        endDate,
        syncMeetings: true,
      });
      await loadSchedules();
      Alert.alert(
        'Lista publicada',
        `Se sincronizaron ${result.syncedMeetings} reuniones. Pendientes sin reunion: ${result.missingMeetings}.`
      );
    } catch (requestError) {
      Alert.alert('No se pudo publicar', formatFirestoreError(requestError));
    } finally {
      setPublishing(false);
    }
  }, [congregationId, endDate, loadSchedules, saveDraft, startDate, uid]);

  if (loadingProfile || loading) {
    return <LoadingState message="Cargando acomodadores y microfonos..." />;
  }

  if (!congregationId) {
    return <ErrorState message={profileError ?? 'No hay congregacion activa.'} />;
  }

  if (!canManage) {
    return <ErrorState message="No tienes permiso para gestionar acomodadores y microfonos." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void loadInitial()} />;
  }

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <PageHeader
        title="Acomodadores"
        subtitle="Planeacion y microfonos"
        showBack
        actions={
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => void loadRows()}
              accessibilityLabel="Recargar reuniones"
            >
              <Ionicons name="refresh-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        }
      />

      <FlatList
        data={rows}
        keyExtractor={(item) => item.meetingId}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.topStack}>
            <View style={styles.panel}>
              <ThemedText style={styles.sectionTitle}>Lista de trabajo</ThemedText>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Titulo"
                placeholderTextColor={colors.textDisabled}
              />
              <View style={styles.dateRow}>
                <TextInput
                  style={[styles.input, styles.dateInput]}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textDisabled}
                  autoCapitalize="none"
                />
                <TextInput
                  style={[styles.input, styles.dateInput]}
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textDisabled}
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => void loadRows()}
                  disabled={saving || publishing}
                >
                  <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                  <ThemedText style={styles.secondaryButtonText}>Cargar reuniones</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleSave}
                  disabled={saving || publishing}
                >
                  <Ionicons name="save-outline" size={16} color={colors.primary} />
                  <ThemedText style={styles.secondaryButtonText}>
                    {saving ? 'Guardando...' : 'Guardar'}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handlePublish}
                  disabled={saving || publishing}
                >
                  <Ionicons name="cloud-upload-outline" size={16} color={colors.onPrimary} />
                  <ThemedText style={styles.primaryButtonText}>
                    {publishing ? 'Publicando...' : 'Publicar'}
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
                      {schedule.status === 'published' ? 'Publicada' : 'Borrador'}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}

            <View style={styles.counterPill}>
              <View style={styles.counterDot} />
              <ThemedText style={styles.counterText}>
                {rows.length} reunion{rows.length === 1 ? '' : 'es'} en el rango
              </ThemedText>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.meetingCard}>
            <View style={styles.meetingHeader}>
              <View style={styles.meetingTitleWrap}>
                <ThemedText style={styles.meetingTitle}>{item.meetingTitle}</ThemedText>
                <ThemedText style={styles.meetingMeta}>
                  {item.meetingDate} · {item.meetingType === 'midweek' ? 'Entre semana' : 'Fin de semana'}
                </ThemedText>
              </View>
            </View>

            {rolesForMeetingType(item.meetingType).map((roleKey) => {
              const optionKey = `${item.meetingId}-${roleKey}`;
              const selectedUserId = item.assignments[roleKey];
              const selectedUser = selectedUserId ? usersById.get(selectedUserId) : undefined;
              const expanded = expandedKey === optionKey;

              return (
                <View key={optionKey} style={styles.roleBlock}>
                  <TouchableOpacity
                    style={styles.roleButton}
                    onPress={() => setExpandedKey(expanded ? null : optionKey)}
                  >
                    <View style={styles.roleTextWrap}>
                      <ThemedText style={styles.roleTitle}>{ROLE_LABELS[roleKey]}</ThemedText>
                      <ThemedText style={styles.roleUser}>
                        {selectedUser?.displayName ?? 'Sin asignar'}
                      </ThemedText>
                    </View>
                    <Ionicons
                      name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                      size={18}
                      color={colors.textMuted}
                    />
                  </TouchableOpacity>

                  {expanded ? (
                    <View style={styles.userPicker}>
                      <TouchableOpacity
                        style={styles.userOption}
                        onPress={() => {
                          setRoleUser(item.meetingId, roleKey, undefined);
                          setExpandedKey(null);
                        }}
                      >
                        <ThemedText style={styles.userOptionName}>Sin asignar</ThemedText>
                      </TouchableOpacity>
                      {users.map((user) => (
                        <TouchableOpacity
                          key={user.uid}
                          style={styles.userOption}
                          onPress={() => {
                            setRoleUser(item.meetingId, roleKey, user.uid);
                            setExpandedKey(null);
                          }}
                        >
                          <ThemedText style={styles.userOptionName}>{user.displayName}</ThemedText>
                          {user.email ? (
                            <ThemedText style={styles.userOptionMeta}>{user.email}</ThemedText>
                          ) : null}
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <EmptyState
            icon="calendar-clear-outline"
            title="Sin reuniones en el rango"
            description="Ajusta las fechas y carga las reuniones para generar la lista."
          />
        }
        showsVerticalScrollIndicator={false}
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
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
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
    userPicker: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      maxHeight: 260,
    },
    userOption: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    userOptionName: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    userOptionMeta: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 1,
    },
  });
