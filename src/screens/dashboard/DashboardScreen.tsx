import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AssignmentCard } from '@/src/components/cards/AssignmentCard';
import { MeetingCard } from '@/src/components/cards/MeetingCard';
import { StatCard } from '@/src/components/cards/StatCard';
import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { NotificationsBadge } from '@/src/features/notifications/components/NotificationsBadge';
import { useAuth } from '@/src/context/auth-context';
import { useUser } from '@/src/context/user-context';
import { getDashboardData } from '@/src/services/dashboard/dashboard-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { Assignment } from '@/src/types/assignment';
import { DashboardMetrics } from '@/src/types/dashboard';
import { Meeting } from '@/src/types/meeting';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { canManageAssignments, canManageUsers } from '@/src/utils/permissions/permissions';

export function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { appUser, congregationId, role, loadingProfile, profileError } = useUser();
  const colors = useAppColors();
  const styles = createStyles(colors);

  const [metrics, setMetrics] = useState<Partial<DashboardMetrics>>({});
  const [recentMeetings, setRecentMeetings] = useState<Meeting[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [usingSummary, setUsingSummary] = useState(true);

  const isAdmin = canManageUsers(role);
  const canManage = canManageAssignments(role);

  const loadData = useCallback(async (forceServer = false) => {
    const uid = user?.uid;

    if (!uid) {
      setMetrics({});
      setRecentMeetings([]);
      setPendingAssignments([]);
      setError('No hay una sesion activa.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (!congregationId) {
      setMetrics({});
      setRecentMeetings([]);
      setPendingAssignments([]);
      setError(profileError ?? 'No se encontro la congregacion del usuario actual.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setError(null);
      const dashboard = await getDashboardData({
        congregationId,
        uid,
        isAdmin,
        canManageAssignments: canManage,
        forceServer,
      });

      setMetrics(dashboard.metrics);
      setRecentMeetings(dashboard.recentMeetings);
      setPendingAssignments(dashboard.pendingAssignments);
      setUsingSummary(dashboard.usedSummary);
    } catch (loadError) {
      setMetrics({});
      setRecentMeetings([]);
      setPendingAssignments([]);
      setUsingSummary(false);
      setError(formatFirestoreError(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canManage, congregationId, isAdmin, profileError, user?.uid]);

  useEffect(() => {
    if (loadingProfile) {
      return;
    }

    void loadData(false);
  }, [loadData, loadingProfile]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadData(true);
  };

  if (loading || loadingProfile) return <LoadingState message="Cargando dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={() => void loadData(true)} />;

  return (
    <ScreenContainer refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.greeting}>
        <View>
          <ThemedText style={styles.greetingLabel}>Bienvenido,</ThemedText>
          <ThemedText style={styles.greetingName}>{appUser?.displayName?.split(' ')[0] ?? 'Usuario'}</ThemedText>
        </View>

        <TouchableOpacity
          style={styles.notificationsButton}
          onPress={() => router.push('/(protected)/notifications' as any)}
          activeOpacity={0.8}
        >
          <Ionicons name="notifications-outline" size={18} color={colors.textPrimary} />
          <NotificationsBadge compact />
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <StatCard title="Asignaciones" value={metrics.totalAssignments ?? 0} icon="checkmark-done-outline" color={colors.primary} />
        <StatCard title="Pendientes" value={metrics.pendingAssignments ?? 0} icon="time-outline" color={colors.warning} />
      </View>

      {isAdmin && (
        <View style={styles.statsRow}>
          <StatCard title="Reuniones" value={metrics.totalMeetings ?? 0} icon="calendar-outline" color={colors.accent} />
          <StatCard title="Usuarios" value={metrics.totalUsers ?? 0} icon="people-outline" color={colors.secondary} />
        </View>
      )}

      {metrics.overdueAssignments ? (
        <View style={styles.alertBanner}>
          <Ionicons name="warning-outline" size={16} color={colors.error} />
          <ThemedText style={styles.alertText}>
            {metrics.overdueAssignments} asignacion{metrics.overdueAssignments > 1 ? 'es vencidas' : ' vencida'}
          </ThemedText>
        </View>
      ) : null}

      {!usingSummary ? (
        <View style={styles.summaryNotice}>
          <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
          <ThemedText style={styles.summaryNoticeText}>
            Resumen precalculado no disponible. Mostrando datos del rango visible.
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Proximas reuniones</ThemedText>
          <TouchableOpacity onPress={() => router.push('/(protected)/(tabs)/meetings' as any)}>
            <ThemedText style={styles.seeAll}>Ver todas</ThemedText>
          </TouchableOpacity>
        </View>
        {recentMeetings.length === 0 ? (
          <ThemedText style={styles.emptyText}>No hay reuniones programadas.</ThemedText>
        ) : (
          <View style={styles.list}>
            {recentMeetings.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} />
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Asignaciones pendientes</ThemedText>
          <TouchableOpacity onPress={() => router.push('/(protected)/(tabs)/assignments' as any)}>
            <ThemedText style={styles.seeAll}>Ver todas</ThemedText>
          </TouchableOpacity>
        </View>
        {pendingAssignments.length === 0 ? (
          <ThemedText style={styles.emptyText}>Sin asignaciones pendientes.</ThemedText>
        ) : (
          <View style={styles.list}>
            {pendingAssignments.map((assignment) => (
              <AssignmentCard key={assignment.id} assignment={assignment} />
            ))}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    greeting: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    greetingLabel: {
      fontSize: 14,
      color: colors.textMuted,
    },
    greetingName: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    notificationsButton: {
      minWidth: 42,
      height: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingHorizontal: 8,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    alertBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.error + '22',
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.error + '44',
    },
    alertText: {
      color: colors.error,
      fontSize: 13,
      fontWeight: '600',
    },
    summaryNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.warning + '20',
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.warning + '44',
    },
    summaryNoticeText: {
      color: colors.warning,
      fontSize: 12,
      fontWeight: '600',
      flex: 1,
    },
    section: {
      marginTop: 8,
      marginBottom: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    seeAll: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '600',
    },
    list: {
      gap: 10,
    },
    emptyText: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      paddingVertical: 16,
    },
  });
