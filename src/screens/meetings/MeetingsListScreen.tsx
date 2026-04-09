import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { MeetingCard } from '@/src/components/cards/MeetingCard';
import { LoadingState } from '@/src/components/common/LoadingState';
import { EmptyState } from '@/src/components/common/EmptyState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { RoleGuard } from '@/src/components/common/RoleGuard';
import { StatusBadge, meetingStatusColor } from '@/src/components/common/StatusBadge';
import { AppColors } from '@/src/constants/app-colors';
import { ThemedText } from '@/src/components/themed-text';
import { subscribeToMeetings } from '@/src/services/meetings/meetings-service';
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
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filter, setFilter] = useState<MeetingStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setError(null);
    const unsub = subscribeToMeetings((data) => {
      setMeetings(data);
      setLoading(false);
      setRefreshing(false);
    });
    return unsub;
  }, []);

  const filtered =
    filter === 'all' ? meetings : meetings.filter((m) => m.status === filter);

  const onRefresh = () => setRefreshing(true);

  if (loading) return <LoadingState message="Cargando reuniones..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <ScreenContainer refreshing={refreshing} onRefresh={onRefresh} padded={false}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <ThemedText style={styles.count}>
          {filtered.length} reunión{filtered.length !== 1 ? 'es' : ''}
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

      {/* Filters */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterChip, filter === f.value && styles.filterChipActive]}
            onPress={() => setFilter(f.value)}
            activeOpacity={0.8}
          >
            <ThemedText
              style={[styles.filterText, filter === f.value && styles.filterTextActive]}
            >
              {f.label}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="Sin reuniones"
          description={filter !== 'all' ? `No hay reuniones ${MEETING_STATUS_LABELS[filter as MeetingStatus]?.toLowerCase()}.` : 'Aún no hay reuniones registradas.'}
          actionLabel="Crear reunión"
          onAction={() => router.push('/(protected)/meetings/create')}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MeetingCard meeting={item} />}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  list: { padding: 16, paddingBottom: 32 },
  separator: { height: 10 },
});
