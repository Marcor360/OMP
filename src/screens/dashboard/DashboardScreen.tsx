import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/src/i18n/index';

import { AssignmentCard } from '@/src/components/cards/AssignmentCard';
import { MeetingCard } from '@/src/components/cards/MeetingCard';
import { StatCard } from '@/src/components/cards/StatCard';
import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { OmpWelcomeNotice } from '@/src/components/common/OmpWelcomeNotice';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { NotificationsBadge } from '@/src/features/notifications/components/NotificationsBadge';
import { DashboardEventsSection } from '@/src/modules/events/components/DashboardEventsSection';
import { useAuth } from '@/src/context/auth-context';
import { useUser } from '@/src/context/user-context';
import { getCongregationDisplayName } from '@/src/services/congregations/congregations-service';
import { getDashboardData } from '@/src/services/dashboard/dashboard-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { Assignment } from '@/src/types/assignment';
import { DashboardMetrics } from '@/src/types/dashboard';
import { Meeting } from '@/src/types/meeting';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { canManageAssignments, canManageCleaning, canManageUsers, canViewUsers } from '@/src/utils/permissions/permissions';
// MÃ³dulo local: Contador de Horas de PredicaciÃ³n (sin Firebase)
import { FieldServiceDashboardCard } from '@/src/modules/field-service/components/FieldServiceDashboardCard';
import { useRefreshOnFocus } from '@/src/hooks/use-refresh-on-focus';
import { MyCleaningDashboardCard } from '@/src/modules/cleaning/components/MyCleaningDashboardCard';
import { useMyCleaningDashboard } from '@/src/modules/cleaning/hooks/use-my-cleaning-dashboard';
import { useEvents } from '@/src/hooks/use-events';

const getDashboardAssignmentKey = (assignment: Assignment, index: number): string => {
  const dueMillis = assignment.dueDate?.toMillis?.() ?? index;
  return `${assignment.meetingId ?? 'standalone'}:${assignment.id}:${dueMillis}:${index}`;
};

export function DashboardScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const {
    appUser,
    congregationId,
    loadingProfile,
    profileError,
  } = useUser();
  const colors = useAppColors();
  const isCompact = width < 520;
  const styles = createStyles(colors, isCompact);
  const { t } = useI18n();

  const [metrics, setMetrics] = useState<Partial<DashboardMetrics>>({});
  const [recentMeetings, setRecentMeetings] = useState<Meeting[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState<Assignment[]>([]);
  const [congregationName, setCongregationName] = useState<string>(t('dashboard.noCongregation'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [, setUsingSummary] = useState(true);

  const {
    summary: cleaningSummary,
    loading: cleaningLoading,
    error: cleaningError,
    refresh: refreshCleaningSummary,
  } = useMyCleaningDashboard({
    uid: user?.uid ?? null,
    congregationId,
    cleaningGroupId: appUser?.cleaningGroupId,
    cleaningGroupName: appUser?.cleaningGroupName,
    enabled: !loadingProfile,
  });

  const isAdmin = canManageUsers(appUser);
  const canManage = canManageAssignments(appUser);
  const canManageCleaningGroups = canManageCleaning(appUser);
  const canOpenUsers = canViewUsers(appUser);
  const {
    events,
    loading: eventsLoading,
    error: eventsError,
    refresh: refreshEvents,
  } = useEvents(congregationId);

  const loadingRef = React.useRef(false);

  const loadData = useCallback(async (forceServer = false) => {
    // Evitar llamadas concurrentes
    if (loadingRef.current) return;
    loadingRef.current = true;

    const uid = user?.uid;

    if (!uid) {
      setMetrics({});
      setRecentMeetings([]);
      setPendingAssignments([]);
      setError(t('dashboard.noActiveSession'));
      setLoading(false);
      setRefreshing(false);
      loadingRef.current = false;
      return;
    }

    if (!congregationId) {
      setMetrics({});
      setRecentMeetings([]);
      setPendingAssignments([]);
      setError(profileError ?? t('dashboard.noCongregationFound'));
      setLoading(false);
      setRefreshing(false);
      loadingRef.current = false;
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
      loadingRef.current = false;
    }
  }, [canManage, congregationId, isAdmin, profileError, t, user?.uid]);

  useEffect(() => {
    if (loadingProfile) {
      return;
    }

    void loadData(true);
  }, [loadData, loadingProfile]);

  // Refresca datos cuando el usuario regresa a esta tab o la app vuelve al primer plano.
  // Regla: al cambiar de ventana/tab, intentar lectura desde servidor.
  const handleFocusRefresh = useCallback(() => {
    if (!loadingProfile) {
      void loadData(true);
      void refreshCleaningSummary();
      void refreshEvents();
    }
  }, [loadData, loadingProfile, refreshCleaningSummary, refreshEvents]);

  useRefreshOnFocus(handleFocusRefresh, true, {
    refreshOnAppActive: false,
    skipInitialFocus: false,
  });

  useEffect(() => {
    if (!congregationId) {
      setCongregationName(t('dashboard.noCongregation'));
      return;
    }

    let cancelled = false;

    getCongregationDisplayName(congregationId, { forceServer: true })
      .then((resolvedName) => {
        if (cancelled) return;
        setCongregationName(resolvedName);
      })
      .catch(() => {
        if (cancelled) return;
        setCongregationName(congregationId);
      });

    return () => {
      cancelled = true;
    };
  }, [congregationId, t]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadData(true);
    void refreshCleaningSummary();
    void refreshEvents();
  };

  if (loading || loadingProfile) return <LoadingState message={t('dashboard.loading')} />;
  if (error) return <ErrorState message={error} onRetry={() => void loadData(true)} />;

  return (
    <ScreenContainer refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.greeting}>
        <View style={styles.greetingMain}>
          <ThemedText style={styles.greetingLabel}>{t('dashboard.welcome')}</ThemedText>
          <ThemedText style={styles.greetingName} numberOfLines={1}>
            {appUser?.displayName?.split(' ')[0] ?? t('dashboard.user')}
          </ThemedText>
          <View style={styles.congregationPill}>
            <Ionicons name="home-outline" size={14} color={colors.textMuted} />
            <ThemedText style={styles.congregationPillText} numberOfLines={1}>
              {congregationName}
            </ThemedText>
          </View>
        </View>

        <TouchableOpacity
          style={styles.notificationsButton}
          onPress={() => {
            router.push('/(protected)/notifications');
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="notifications-outline" size={18} color={colors.textPrimary} />
          <NotificationsBadge compact />
        </TouchableOpacity>
      </View>

      <OmpWelcomeNotice />

      <View style={styles.statsRow}>
        <StatCard title={t('dashboard.assignments')} value={metrics.totalAssignments ?? 0} icon="checkmark-done-outline" color={colors.primary} onPress={() => router.push('/(protected)/(tabs)/assignments')} />
        <StatCard title={t('dashboard.pending')} value={metrics.pendingAssignments ?? 0} icon="time-outline" color={colors.warning} onPress={() => router.push('/(protected)/(tabs)/assignments')} />
      </View>

      {isAdmin && (
        <View style={styles.statsRow}>
          <StatCard title={t('dashboard.meetings')} value={metrics.totalMeetings ?? 0} icon="calendar-outline" color={colors.accent} onPress={() => router.push('/(protected)/(tabs)/meetings')} />
          <StatCard title={t('dashboard.users')} value={metrics.totalUsers ?? 0} icon="people-outline" color={colors.secondary} onPress={canOpenUsers ? () => router.push('/(protected)/(tabs)/users') : undefined} />
        </View>
      )}

      {metrics.overdueAssignments ? (
        <View style={styles.alertBanner}>
          <Ionicons name="warning-outline" size={16} color={colors.error} />
          <ThemedText style={styles.alertText}>
            {t(metrics.overdueAssignments === 1 ? 'dashboard.overdueCount' : 'dashboard.overdueCount_plural', { count: metrics.overdueAssignments })}
          </ThemedText>
        </View>
      ) : null}

      {/* â”€â”€ Contador de Horas de PredicaciÃ³n (solo dispositivo mÃ³vil) â”€â”€ */}
      {Platform.OS !== 'web' && <FieldServiceDashboardCard />}

      <TouchableOpacity
        style={styles.preachingCard}
        onPress={() => {
          router.push('/(protected)/(tabs)/preaching');
        }}
        activeOpacity={0.85}
      >
        <View style={styles.preachingIcon}>
          <Ionicons name="document-text-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.preachingText}>
          <ThemedText style={styles.preachingTitle}>{t('dashboard.preaching')}</ThemedText>
          <ThemedText style={styles.preachingSubtitle}>
            {t('dashboard.preachingSubtitle')}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.preachingCard}
        onPress={() => {
          router.push('/(protected)/organization-chart');
        }}
        activeOpacity={0.85}
      >
        <View style={styles.preachingIcon}>
          <Ionicons name="git-network-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.preachingText}>
          <ThemedText style={styles.preachingTitle}>{t('dashboard.organizationChart')}</ThemedText>
          <ThemedText style={styles.preachingSubtitle}>
            {t('dashboard.organizationChartSubtitle')}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
      </TouchableOpacity>

      <DashboardEventsSection
        events={events}
        loading={eventsLoading}
        error={eventsError}
        canManage={canManage}
        congregationId={congregationId}
        onRefresh={refreshEvents}
      />

      <MyCleaningDashboardCard
        summary={cleaningSummary}
        loading={cleaningLoading}
        error={cleaningError}
        canOpenDetails={canManageCleaningGroups}
      />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>{t('dashboard.upcomingMeetings')}</ThemedText>
          <TouchableOpacity
            onPress={() => {
              router.push('/(protected)/(tabs)/meetings');
            }}
          >
            <ThemedText style={styles.seeAll}>{t('dashboard.seeAll')}</ThemedText>
          </TouchableOpacity>
        </View>
        {recentMeetings.length === 0 ? (
          <ThemedText style={styles.emptyText}>{t('dashboard.noUpcomingMeetings')}</ThemedText>
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
          <ThemedText style={styles.sectionTitle}>{t('dashboard.pendingAssignments')}</ThemedText>
          <TouchableOpacity
            onPress={() => {
              router.push('/(protected)/(tabs)/assignments');
            }}
          >
            <ThemedText style={styles.seeAll}>{t('dashboard.seeAll')}</ThemedText>
          </TouchableOpacity>
        </View>
        {pendingAssignments.length === 0 ? (
          <ThemedText style={styles.emptyText}>{t('dashboard.noPendingAssignments')}</ThemedText>
        ) : (
          <View style={styles.list}>
            {pendingAssignments.map((assignment, index) => (
              <AssignmentCard key={getDashboardAssignmentKey(assignment, index)} assignment={assignment} />
            ))}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

const createStyles = (colors: AppColorSet, isCompact: boolean) =>
  StyleSheet.create({
    greeting: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 20,
    },
    greetingMain: {
      flex: 1,
      minWidth: 0,
      paddingRight: 8,
    },
    greetingLabel: {
      fontSize: isCompact ? 13 : 14,
      color: colors.textMuted,
    },
    greetingName: {
      fontSize: isCompact ? 22 : 26,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    congregationPill: {
      marginTop: 8,
      alignSelf: 'flex-start',
      maxWidth: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: isCompact ? 4 : 6,
    },
    congregationPillText: {
      fontSize: isCompact ? 12 : 13,
      color: colors.textSecondary,
      fontWeight: '600',
      flexShrink: 1,
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
    preachingCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
    },
    preachingIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary + '18',
    },
    preachingText: {
      flex: 1,
      minWidth: 0,
    },
    preachingTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    preachingSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
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

