import React, { useCallback } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { EmptyState } from '@/src/components/common/EmptyState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { AssignmentCard } from '@/src/modules/assignments/components/AssignmentCard';
import { AssignmentSummaryCards } from '@/src/modules/assignments/components/AssignmentSummaryCards';
import { AssignmentTabs } from '@/src/modules/assignments/components/AssignmentTabs';
import { useAssignmentFilters } from '@/src/modules/assignments/hooks/useAssignmentFilters';
import { useAssignments } from '@/src/modules/assignments/hooks/useAssignments';
import {
  Assignment,
  ASSIGNMENT_CATEGORY_LABELS,
} from '@/src/modules/assignments/types/assignment.types';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { useUser } from '@/src/context/user-context';
import { RoleGuard } from '@/src/components/common/RoleGuard';

export function AssignmentsScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { appUser, congregationId, loadingProfile, profileError, uid } = useUser();

  const {
    activeTab,
    filters,
    setCategory,
  } = useAssignmentFilters(congregationId ?? '');

  const {
    assignments,
    summary,
    loading,
    refreshing,
    error,
    onRefresh,
    reload,
  } = useAssignments({
    congregationId,
    filters,
    uid,
    cleaningGroupId: appUser?.cleaningGroupId,
    cleaningGroupName: appUser?.cleaningGroupName,
  });

  const openDetail = useCallback(
    (assignment: Assignment) => {
      const queryParts = [`source=${encodeURIComponent(assignment.source)}`];

      if (assignment.meetingId) {
        queryParts.push(`meetingId=${encodeURIComponent(assignment.meetingId)}`);
      }

      const query = queryParts.join('&');
      router.push(`/(protected)/assignments/${assignment.id}?${query}` as never);
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: Assignment }) => (
      <AssignmentCard assignment={item} onPress={() => openDetail(item)} />
    ),
    [openDetail]
  );

  const keyExtractor = useCallback((item: Assignment) => item.sourceKey, []);

  if (loadingProfile) {
    return <LoadingState message="Cargando perfil..." />;
  }

  if (!congregationId) {
    return <ErrorState message={profileError ?? 'No hay congregacion activa para consultar asignaciones.'} />;
  }

  if (loading) {
    return <LoadingState message="Cargando asignaciones..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void reload(true)} />;
  }

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <PageHeader
        title="Asignaciones"
        subtitle="Panel de solo lectura"
        actions={
          <RoleGuard allowedRoles={['admin', 'supervisor']}>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/(protected)/assignments/create' as never)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={16} color={colors.primary} />
              <ThemedText style={styles.createButtonText}>Nuevo</ThemedText>
            </TouchableOpacity>
          </RoleGuard>
        }
      />

      <FlatList
        data={assignments}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <>
            <AssignmentSummaryCards
              summary={summary}
              activeTab={activeTab}
              onSelect={setCategory}
            />

            <AssignmentTabs activeTab={activeTab} onChange={setCategory} />

            <View style={styles.counterRow}>
              <View style={styles.counterPill}>
                <View style={styles.counterDot} />
                <ThemedText style={styles.counterText}>
                  {assignments.length} resultado{assignments.length === 1 ? '' : 's'} en{' '}
                  {ASSIGNMENT_CATEGORY_LABELS[activeTab].toLowerCase()}
                </ThemedText>
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="list-outline"
              title="Sin asignaciones para este filtro"
              description="Ajusta los filtros o cambia de categoria para ver resultados."
            />
          </View>
        }
        refreshing={refreshing}
        onRefresh={onRefresh}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={8}
      />
    </ScreenContainer>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    listContent: {
      paddingBottom: 28,
    },
    separator: {
      height: 10,
    },
    counterRow: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    counterPill: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
    },
    counterDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    counterText: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.primary + '66',
      backgroundColor: colors.primary + '1A',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    createButtonText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 12,
    },
    emptyWrap: {
      minHeight: 260,
      paddingTop: 8,
    },
  });
