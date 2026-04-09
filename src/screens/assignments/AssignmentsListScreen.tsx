import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { AssignmentCard } from '@/src/components/cards/AssignmentCard';
import { LoadingState } from '@/src/components/common/LoadingState';
import { EmptyState } from '@/src/components/common/EmptyState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { RoleGuard } from '@/src/components/common/RoleGuard';
import { AppColors } from '@/src/constants/app-colors';
import { ThemedText } from '@/src/components/themed-text';
import { subscribeToAssignments } from '@/src/services/assignments/assignments-service';
import { Assignment, AssignmentStatus, ASSIGNMENT_STATUS_LABELS } from '@/src/types/assignment';
import { useUser } from '@/src/context/user-context';
import { useAuth } from '@/src/context/auth-context';
import { canManageAssignments } from '@/src/utils/permissions/permissions';

const FILTERS: Array<{ label: string; value: AssignmentStatus | 'all' }> = [
  { label: 'Todas', value: 'all' },
  { label: 'Pendientes', value: 'pending' },
  { label: 'En progreso', value: 'in_progress' },
  { label: 'Completadas', value: 'completed' },
];

export function AssignmentsListScreen() {
  const router = useRouter();
  const { role } = useUser();
  const { user } = useAuth();
  const isManager = canManageAssignments(role);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [filter, setFilter] = useState<AssignmentStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Admin/supervisor ve todas; user solo las suyas
    const unsub = subscribeToAssignments(
      (data) => {
        setAssignments(data);
        setLoading(false);
        setRefreshing(false);
      },
      isManager ? undefined : user?.uid
    );
    return unsub;
  }, [isManager, user?.uid]);

  const filtered =
    filter === 'all' ? assignments : assignments.filter((a) => a.status === filter);

  const onRefresh = () => setRefreshing(true);

  if (loading) return <LoadingState message="Cargando asignaciones..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <ScreenContainer refreshing={refreshing} onRefresh={onRefresh} padded={false}>
      <View style={styles.toolbar}>
        <ThemedText style={styles.count}>
          {filtered.length} asignación{filtered.length !== 1 ? 'es' : ''}
        </ThemedText>
        <RoleGuard allowedRoles={['admin', 'supervisor']}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/(protected)/assignments/create')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <ThemedText style={styles.addButtonText}>Nueva</ThemedText>
          </TouchableOpacity>
        </RoleGuard>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.chip, filter === f.value && styles.chipActive]}
            onPress={() => setFilter(f.value)}
            activeOpacity={0.8}
          >
            <ThemedText style={[styles.chipText, filter === f.value && styles.chipTextActive]}>
              {f.label}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.length === 0 ? (
        <EmptyState
          icon="checkmark-done-outline"
          title="Sin asignaciones"
          description={
            filter !== 'all'
              ? `No hay asignaciones ${ASSIGNMENT_STATUS_LABELS[filter as AssignmentStatus]?.toLowerCase()}.`
              : '¡Todo al día!'
          }
          actionLabel={isManager ? 'Crear asignación' : undefined}
          onAction={isManager ? () => router.push('/(protected)/assignments/create') : undefined}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => <AssignmentCard assignment={item} />}
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
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  chipActive: { backgroundColor: AppColors.primary, borderColor: AppColors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: AppColors.textMuted },
  chipTextActive: { color: '#fff' },
  list: { padding: 16, paddingBottom: 32 },
  separator: { height: 10 },
});
