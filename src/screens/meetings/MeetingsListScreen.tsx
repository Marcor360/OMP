import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { MeetingCard } from '@/src/components/cards/MeetingCard';
import { EmptyState } from '@/src/components/common/EmptyState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { RoleGuard } from '@/src/components/common/RoleGuard';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import { getMeetingsByWeek } from '@/src/services/meetings/meetings-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import {
  Meeting,
  MeetingStatus,
  MEETING_STATUS_LABELS,
  resolveMeetingCategory,
} from '@/src/types/meeting';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { formatWeekLabel, getWeekEnd, getWeekStart, moveWeek } from '@/src/utils/dates/week-range';

const STATUS_FILTERS: { label: string; value: MeetingStatus | 'all' }[] = [
  { label: 'Todas', value: 'all' },
  { label: 'Pendientes', value: 'pending' },
  { label: 'Programadas', value: 'scheduled' },
  { label: 'En progreso', value: 'in_progress' },
  { label: 'Completadas', value: 'completed' },
];

export function MeetingsListScreen() {
  const router = useRouter();
  const { congregationId, loadingProfile, isAdminOrSupervisor } = useUser();
  const colors = useAppColors();
  const styles = createStyles(colors);

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filter, setFilter] = useState<MeetingStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const weekEnd = useMemo(() => getWeekEnd(weekStart), [weekStart]);
  const weekLabel = useMemo(() => formatWeekLabel(weekStart, weekEnd), [weekEnd, weekStart]);

  const loadMeetings = useCallback(async (forceServer = false) => {
    if (!congregationId || typeof congregationId !== 'string') {
      setMeetings([]);
      setError('El perfil actual no tiene congregationId.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (!forceServer) {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await getMeetingsByWeek(congregationId, weekStart, weekEnd, {
        forceServer,
        includeMidweek: false,
        maxItems: 80,
      });
      setMeetings(data);
      setError(null);
    } catch (requestError) {
      setMeetings([]);
      setError(formatFirestoreError(requestError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [congregationId, weekEnd, weekStart]);

  useEffect(() => {
    void loadMeetings(false);
  }, [loadMeetings]);

  const genericMeetings = useMemo(
    () => meetings.filter((meeting) => resolveMeetingCategory(meeting) !== 'midweek'),
    [meetings]
  );

  const filtered = useMemo(
    () =>
      filter === 'all'
        ? genericMeetings
        : genericMeetings.filter((meeting) => meeting.status === filter),
    [filter, genericMeetings]
  );

  const onRefresh = async () => {
    if (!congregationId) return;

    setRefreshing(true);
    await loadMeetings(true);
  };

  const goToPreviousWeek = () => {
    setWeekStart((current) => moveWeek(current, -1));
  };

  const goToNextWeek = () => {
    setWeekStart((current) => moveWeek(current, 1));
  };

  const goToCurrentWeek = () => {
    setWeekStart(getWeekStart(new Date()));
  };

  if (loading || loadingProfile) return <LoadingState message="Cargando reuniones..." />;
  if (error) return <ErrorState message={error} />;

  const header = (
    <>
      <View style={styles.toolbar}>
        <ThemedText style={styles.count}>
          {filtered.length} reunion{filtered.length !== 1 ? 'es' : ''}
        </ThemedText>

        <View style={styles.toolbarActions}>
          <TouchableOpacity
            style={styles.midweekButton}
            onPress={() => router.push('/(protected)/meetings/midweek')}
            activeOpacity={0.8}
          >
            <Ionicons name="book-outline" size={18} color={colors.primary} />
            <ThemedText style={styles.midweekButtonText}>VyMC</ThemedText>
          </TouchableOpacity>

          <RoleGuard allowedRoles={['admin', 'supervisor']}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push('/(protected)/meetings/create')}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <ThemedText style={styles.addButtonText}>Nueva</ThemedText>
            </TouchableOpacity>
          </RoleGuard>
        </View>
      </View>

      <View style={styles.weekNavRow}>
        <TouchableOpacity style={styles.weekNavButton} onPress={goToPreviousWeek} activeOpacity={0.8}>
          <Ionicons name="chevron-back-outline" size={16} color={colors.textMuted} />
          <ThemedText style={styles.weekNavButtonText}>Anterior</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.weekCurrentButton} onPress={goToCurrentWeek} activeOpacity={0.8}>
          <ThemedText style={styles.weekCurrentText}>{weekLabel}</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.weekNavButton} onPress={goToNextWeek} activeOpacity={0.8}>
          <ThemedText style={styles.weekNavButtonText}>Siguiente</ThemedText>
          <Ionicons name="chevron-forward-outline" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((item) => (
          <TouchableOpacity
            key={item.value}
            style={[styles.filterChip, filter === item.value && styles.filterChipActive]}
            onPress={() => setFilter(item.value)}
            activeOpacity={0.8}
          >
            <ThemedText style={[styles.filterText, filter === item.value && styles.filterTextActive]}>
              {item.label}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <FlatList
        data={filtered}
        keyExtractor={(meeting) => meeting.id}
        renderItem={({ item }) => <MeetingCard meeting={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="calendar-outline"
              title="Sin reuniones"
              description={
                filter !== 'all'
                  ? `No hay reuniones ${MEETING_STATUS_LABELS[filter as MeetingStatus]?.toLowerCase()}.`
                  : 'Aun no hay reuniones registradas.'
              }
              actionLabel={isAdminOrSupervisor ? 'Crear reunion' : undefined}
              onAction={isAdminOrSupervisor ? () => router.push('/(protected)/meetings/create') : undefined}
            />
          </View>
        }
        refreshing={refreshing}
        onRefresh={onRefresh}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    toolbar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 10,
    },
    count: { fontSize: 13, color: colors.textMuted },
    toolbarActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    midweekButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary + '22',
      borderWidth: 1,
      borderColor: colors.primary + '66',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    midweekButtonText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
    },
    addButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    filterRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    weekNavRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 8,
    },
    weekNavButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    weekNavButtonText: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
    },
    weekCurrentButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary + '55',
      backgroundColor: colors.primary + '12',
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    weekCurrentText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 12,
    },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
    filterTextActive: { color: '#fff' },
    listContent: {
      paddingBottom: 32,
    },
    separator: {
      height: 10,
    },
    emptyWrap: {
      paddingTop: 16,
      paddingHorizontal: 16,
    },
  });
