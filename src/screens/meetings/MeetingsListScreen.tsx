import React, { useEffect, useMemo, useState } from 'react';
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
import { AppColors } from '@/src/constants/app-colors';
import { useUser } from '@/src/context/user-context';
import { getAllMeetings, subscribeToMeetings } from '@/src/services/meetings/meetings-service';
import { Meeting, MeetingStatus, MEETING_STATUS_LABELS } from '@/src/types/meeting';
import { formatFirestoreError } from '@/src/utils/errors/errors';

const STATUS_FILTERS: Array<{ label: string; value: MeetingStatus | 'all' }> = [
  { label: 'Todas', value: 'all' },
  { label: 'Programadas', value: 'scheduled' },
  { label: 'En progreso', value: 'in_progress' },
  { label: 'Completadas', value: 'completed' },
];

export function MeetingsListScreen() {
  const router = useRouter();
  const { congregationId, loadingProfile, profileError, isAdminOrSupervisor } = useUser();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filter, setFilter] = useState<MeetingStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (loadingProfile) return;

    if (!congregationId) {
      setError(profileError ?? 'No se encontro la congregacion del usuario actual.');
      setLoading(false);
      return;
    }

    setError(null);

    const unsubscribe = subscribeToMeetings(
      congregationId,
      (data) => {
        setMeetings(data);
        setLoading(false);
        setRefreshing(false);
      },
      (snapshotError) => {
        setError(formatFirestoreError(snapshotError));
        setLoading(false);
        setRefreshing(false);
      }
    );

    return unsubscribe;
  }, [congregationId, loadingProfile, profileError]);

  const filtered = useMemo(
    () => (filter === 'all' ? meetings : meetings.filter((meeting) => meeting.status === filter)),
    [filter, meetings]
  );

  const onRefresh = async () => {
    if (!congregationId) return;

    setRefreshing(true);

    try {
      const latestMeetings = await getAllMeetings(congregationId);
      setMeetings(latestMeetings);
    } catch (requestError) {
      setError(formatFirestoreError(requestError));
    } finally {
      setRefreshing(false);
    }
  };

  if (loading || loadingProfile) return <LoadingState message="Cargando reuniones..." />;
  if (error) return <ErrorState message={error} />;

  const header = (
    <>
      <View style={styles.toolbar}>
        <ThemedText style={styles.count}>
          {filtered.length} reunion{filtered.length !== 1 ? 'es' : ''}
        </ThemedText>
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

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  count: { fontSize: 13, color: AppColors.textMuted },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: AppColors.primary,
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
    borderBottomColor: AppColors.border,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  filterChipActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  filterText: { fontSize: 12, fontWeight: '600', color: AppColors.textMuted },
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
