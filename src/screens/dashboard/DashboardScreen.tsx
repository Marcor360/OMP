import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { StatCard } from '@/src/components/cards/StatCard';
import { MeetingCard } from '@/src/components/cards/MeetingCard';
import { AssignmentCard } from '@/src/components/cards/AssignmentCard';
import { LoadingState } from '@/src/components/common/LoadingState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { ThemedText } from '@/src/components/themed-text';
import { AppColors } from '@/src/constants/app-colors';
import { useUser } from '@/src/context/user-context';
import { useAuth } from '@/src/context/auth-context';
import { getDashboardMetrics, DashboardMetrics } from '@/src/services/dashboard/dashboard-service';
import { getAllMeetings } from '@/src/services/meetings/meetings-service';
import { getAllAssignments, getAssignmentsByUser } from '@/src/services/assignments/assignments-service';
import { canManageAssignments, canManageUsers } from '@/src/utils/permissions/permissions';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { Meeting } from '@/src/types/meeting';
import { Assignment } from '@/src/types/assignment';

const isIndexError = (error: unknown): boolean => {
  const err = error as { code?: string; message?: string };
  const code = err?.code ?? '';
  const message = (err?.message ?? '').toLowerCase();

  return code.includes('failed-precondition') || message.includes('index');
};

const countOverduePending = (items: Assignment[]): number => {
  const now = Date.now();

  return items.filter((item) => {
    if (item.status !== 'pending' || !item.dueDate) {
      return false;
    }

    return item.dueDate.toDate().getTime() < now;
  }).length;
};

const getUserMetrics = (items: Assignment[]): Partial<DashboardMetrics> => {
  const pending = items.filter((item) => item.status === 'pending').length;
  const completed = items.filter((item) => item.status === 'completed').length;

  return {
    totalAssignments: items.length,
    pendingAssignments: pending,
    completedAssignments: completed,
    overdueAssignments: countOverduePending(items),
  };
};

const getDashboardErrorMessage = (error: unknown): string => {
  if (isIndexError(error)) {
    return 'No se pudo cargar el dashboard. Faltan indices en Firestore para algunas consultas.';
  }

  return `No se pudieron cargar los datos del dashboard. ${formatFirestoreError(error)}`;
};

export function DashboardScreen() {
  const router = useRouter();
  const { appUser, role } = useUser();
  const { user } = useAuth();

  const [metrics, setMetrics] = useState<Partial<DashboardMetrics>>({});
  const [recentMeetings, setRecentMeetings] = useState<Meeting[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = canManageUsers(role);
  const canManage = canManageAssignments(role);

  const loadData = useCallback(async () => {
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

    try {
      setError(null);

      const assignmentsPromise = canManage
        ? getAllAssignments()
        : getAssignmentsByUser(uid).catch(async (queryError) => {
            if (!isIndexError(queryError)) {
              throw queryError;
            }

            const all = await getAllAssignments();
            return all.filter((item) => item.assignedToUid === uid);
          });

      const [meetingsResult, assignmentsResult, metricsResult] = await Promise.allSettled([
        getAllMeetings(),
        assignmentsPromise,
        isAdmin ? getDashboardMetrics() : Promise.resolve(null),
      ]);

      const failures: unknown[] = [];

      let meetingsData: Meeting[] = [];
      if (meetingsResult.status === 'fulfilled') {
        meetingsData = meetingsResult.value;
      } else {
        failures.push(meetingsResult.reason);
      }

      let assignmentsData: Assignment[] = [];
      if (assignmentsResult.status === 'fulfilled') {
        assignmentsData = assignmentsResult.value;
      } else {
        failures.push(assignmentsResult.reason);
      }

      const nextRecentMeetings = meetingsData
        .filter((meeting) => meeting.status === 'scheduled')
        .slice(0, 3);

      const assignmentsForCards = canManage
        ? assignmentsData
        : assignmentsData.filter((item) => item.assignedToUid === uid);

      const nextPendingAssignments = assignmentsForCards
        .filter((item) => item.status === 'pending')
        .slice(0, 5);

      let nextMetrics: Partial<DashboardMetrics> = {};

      if (isAdmin) {
        if (metricsResult.status === 'fulfilled' && metricsResult.value) {
          nextMetrics = metricsResult.value;
        } else if (assignmentsData.length > 0 || meetingsData.length > 0) {
          nextMetrics = {
            totalMeetings: meetingsData.length,
            totalAssignments: assignmentsData.length,
            pendingAssignments: assignmentsData.filter((item) => item.status === 'pending').length,
            completedAssignments: assignmentsData.filter((item) => item.status === 'completed').length,
            overdueAssignments: countOverduePending(assignmentsData),
          };

          if (metricsResult.status === 'rejected') {
            failures.push(metricsResult.reason);
          }
        } else if (metricsResult.status === 'rejected') {
          failures.push(metricsResult.reason);
        }
      } else {
        const mine = assignmentsData.filter((item) => item.assignedToUid === uid);
        nextMetrics = getUserMetrics(mine);
      }

      setMetrics(nextMetrics);
      setRecentMeetings(nextRecentMeetings);
      setPendingAssignments(nextPendingAssignments);

      const hasLoadedSource =
        meetingsResult.status === 'fulfilled' ||
        assignmentsResult.status === 'fulfilled' ||
        (isAdmin ? metricsResult.status === 'fulfilled' : false);

      setError(hasLoadedSource ? null : getDashboardErrorMessage(failures[0]));
    } catch (loadError) {
      setMetrics({});
      setRecentMeetings([]);
      setPendingAssignments([]);
      setError(getDashboardErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canManage, isAdmin, user?.uid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) return <LoadingState message="Cargando dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <ScreenContainer refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.greeting}>
        <View>
          <ThemedText style={styles.greetingLabel}>Bienvenido,</ThemedText>
          <ThemedText style={styles.greetingName}>
            {appUser?.displayName?.split(' ')[0] ?? 'Usuario'}
          </ThemedText>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatCard
          title="Asignaciones"
          value={metrics.totalAssignments ?? 0}
          icon="checkmark-done-outline"
          color={AppColors.primary}
        />
        <StatCard
          title="Pendientes"
          value={metrics.pendingAssignments ?? 0}
          icon="time-outline"
          color={AppColors.warning}
        />
      </View>

      {isAdmin && (
        <View style={styles.statsRow}>
          <StatCard
            title="Reuniones"
            value={metrics.totalMeetings ?? 0}
            icon="calendar-outline"
            color={AppColors.accent}
          />
          <StatCard
            title="Usuarios"
            value={metrics.totalUsers ?? 0}
            icon="people-outline"
            color={AppColors.secondary}
          />
        </View>
      )}

      {metrics.overdueAssignments ? (
        <View style={styles.alertBanner}>
          <Ionicons name="warning-outline" size={16} color={AppColors.error} />
          <ThemedText style={styles.alertText}>
            {metrics.overdueAssignments} asignacion
            {metrics.overdueAssignments > 1 ? 'es vencidas' : ' vencida'}
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

const styles = StyleSheet.create({
  greeting: {
    marginBottom: 20,
  },
  greetingLabel: {
    fontSize: 14,
    color: AppColors.textMuted,
  },
  greetingName: {
    fontSize: 26,
    fontWeight: '800',
    color: AppColors.textPrimary,
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
    backgroundColor: AppColors.error + '22',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: AppColors.error + '44',
  },
  alertText: {
    color: AppColors.error,
    fontSize: 13,
    fontWeight: '600',
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
    color: AppColors.textPrimary,
  },
  seeAll: {
    fontSize: 13,
    color: AppColors.primary,
    fontWeight: '600',
  },
  list: {
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: AppColors.textMuted,
    textAlign: 'center',
    paddingVertical: 16,
  },
});
