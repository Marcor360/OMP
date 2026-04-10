import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AssignmentCard } from '@/src/components/cards/AssignmentCard';
import { EmptyState } from '@/src/components/common/EmptyState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { RoleGuard } from '@/src/components/common/RoleGuard';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { AppColors } from '@/src/constants/app-colors';
import { useUser } from '@/src/context/user-context';
import {
  getAllAssignments,
  getAssignmentsByUser,
  subscribeToAssignments,
} from '@/src/services/assignments/assignments-service';
import { Assignment, AssignmentStatus, ASSIGNMENT_STATUS_LABELS } from '@/src/types/assignment';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { canManageAssignments } from '@/src/utils/permissions/permissions';

const FILTERS: Array<{ label: string; value: AssignmentStatus | 'all' }> = [
  { label: 'Todas', value: 'all' },
  { label: 'Pendientes', value: 'pending' },
  { label: 'En progreso', value: 'in_progress' },
  { label: 'Completadas', value: 'completed' },
];

export function AssignmentsListScreen() {
  const router = useRouter();
  const {
    uid,
    congregationId,
    role,
    loadingProfile,
    profileError,
    isAdminOrSupervisor,
  } = useUser();

  const isManager = canManageAssignments(role);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [filter, setFilter] = useState<AssignmentStatus | 'all'>('all');
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

    const unsubscribe = subscribeToAssignments(
      congregationId,
      (data) => {
        setAssignments(data);
        setLoading(false);
        setRefreshing(false);
      },
      {
        userUid: isManager ? undefined : uid ?? undefined,
      },
      (snapshotError) => {
        setError(formatFirestoreError(snapshotError));
        setLoading(false);
        setRefreshing(false);
      }
    );

    return unsubscribe;
  }, [congregationId, isManager, loadingProfile, profileError, uid]);

  const filtered = useMemo(
    () => (filter === 'all' ? assignments : assignments.filter((item) => item.status === filter)),
    [assignments, filter]
  );

  const onRefresh = async () => {
    if (!congregationId) return;
    if (!isManager && !uid) return;

    setRefreshing(true);

    try {
      const latestAssignments = isManager
        ? await getAllAssignments(congregationId)
        : await getAssignmentsByUser(congregationId, uid!);

      setAssignments(latestAssignments);
    } catch (requestError) {
      setError(formatFirestoreError(requestError));
    } finally {
      setRefreshing(false);
    }
  };

  if (loading || loadingProfile) return <LoadingState message="Cargando asignaciones..." />;
  if (error) return <ErrorState message={error} />;

  const header = (
    <>
      <View style={styles.toolbar}>
        <ThemedText style={styles.count}>
          {filtered.length} asignacion{filtered.length !== 1 ? 'es' : ''}
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
        {FILTERS.map((item) => (
          <TouchableOpacity
            key={item.value}
            style={[styles.chip, filter === item.value && styles.chipActive]}
            onPress={() => setFilter(item.value)}
            activeOpacity={0.8}
          >
            <ThemedText style={[styles.chipText, filter === item.value && styles.chipTextActive]}>
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
        keyExtractor={(assignment) => assignment.id}
        renderItem={({ item }) => <AssignmentCard assignment={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="checkmark-done-outline"
              title="Sin asignaciones"
              description={
                filter !== 'all'
                  ? `No hay asignaciones ${ASSIGNMENT_STATUS_LABELS[filter as AssignmentStatus]?.toLowerCase()}.`
                  : 'Todo al dia.'
              }
              actionLabel={isAdminOrSupervisor ? 'Crear asignacion' : undefined}
              onAction={isAdminOrSupervisor ? () => router.push('/(protected)/assignments/create') : undefined}
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
  listContent: { paddingBottom: 32 },
  separator: { height: 10 },
  emptyWrap: { paddingTop: 16, paddingHorizontal: 16 },
});
