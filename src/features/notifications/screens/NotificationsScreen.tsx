import React, { useCallback, useMemo, useState } from 'react';
import { SectionList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { EmptyState } from '@/src/components/common/EmptyState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { NotificationItem } from '@/src/features/notifications/components/NotificationItem';
import {
  AppNotification,
  NotificationType,
} from '@/src/features/notifications/types/notification.types';
import { resolveNotificationHref } from '@/src/features/notifications/utils/notification-routes';
import { useNotifications } from '@/src/hooks/useNotifications';
import { useI18n } from '@/src/i18n/index';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { getSafeNotificationHref } from '@/src/utils/navigation/redirect';

const resolveAssignmentHref = (notification: AppNotification): Href =>
  getSafeNotificationHref(
    notification.data?.url ?? resolveNotificationHref(notification)
  ) as Href;

type NotificationFilter = 'all' | NotificationType;
type NotificationSection = {
  titleKey: string;
  data: AppNotification[];
};

const FILTERS: { key: NotificationFilter; labelKey: string }[] = [
  { key: 'all', labelKey: 'notifications.filter.all' },
  { key: 'assignment', labelKey: 'notifications.filter.assignments' },
  { key: 'event', labelKey: 'notifications.filter.events' },
  { key: 'billing', labelKey: 'notifications.filter.billing' },
];

const startOfWeekMillis = (today: Date): number => {
  const start = new Date(today);
  const day = start.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - daysSinceMonday);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
};

const groupNotifications = (notifications: AppNotification[]): NotificationSection[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMillis = today.getTime();
  const weekMillis = startOfWeekMillis(today);
  const groups: NotificationSection[] = [
    { titleKey: 'notifications.section.today', data: [] },
    { titleKey: 'notifications.section.thisWeek', data: [] },
    { titleKey: 'notifications.section.previous', data: [] },
  ];

  notifications.forEach((notification) => {
    const createdAtMillis = notification.createdAt.seconds * 1000;
    if (createdAtMillis >= todayMillis) {
      groups[0].data.push(notification);
    } else if (createdAtMillis >= weekMillis) {
      groups[1].data.push(notification);
    } else {
      groups[2].data.push(notification);
    }
  });

  return groups.filter((group) => group.data.length > 0);
};

export function NotificationsScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { t } = useI18n();
  const [filter, setFilter] = useState<NotificationFilter>('all');

  const {
    notifications,
    loading,
    refreshing,
    error,
    refresh,
    markRead,
    markAllRead,
  } = useNotifications();

  const filterCounts = useMemo<Record<NotificationFilter, number>>(() => ({
    all: notifications.length,
    assignment: notifications.filter((item) => item.type === 'assignment').length,
    event: notifications.filter((item) => item.type === 'event').length,
    billing: notifications.filter((item) => item.type === 'billing').length,
  }), [notifications]);
  const filteredNotifications = useMemo(
    () => filter === 'all'
      ? notifications
      : notifications.filter((item) => item.type === filter),
    [filter, notifications]
  );
  const sections = useMemo(
    () => groupNotifications(filteredNotifications),
    [filteredNotifications]
  );
  const unreadCount = notifications.filter((item) => !item.read).length;
  const filteredUnreadCount = filteredNotifications.filter((item) => !item.read).length;

  const onPressItem = useCallback(
    async (notification: AppNotification) => {
      if (!notification.read) {
        await markRead(notification.id);
      }

      router.push(resolveAssignmentHref(notification));
    },
    [markRead, router]
  );

  const onMarkAll = useCallback(async () => {
    await markAllRead();
  }, [markAllRead]);

  if (loading) {
    return <LoadingState message={t('notifications.loading')} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void refresh()} />;
  }

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <PageHeader
        title={t('notifications.title')}
        subtitle={t('notifications.subtitle')}
        showBack
        actions={
          unreadCount > 0 ? (
            <TouchableOpacity style={styles.markAllButton} onPress={onMarkAll} activeOpacity={0.8}>
              <Ionicons name="checkmark-done-outline" size={14} color={colors.primary} />
              <ThemedText style={styles.markAllText}>{t('notifications.markAll')}</ThemedText>
            </TouchableOpacity>
          ) : undefined
        }
      />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.itemWrap}>
            <NotificationItem notification={item} onPress={onPressItem} />
          </View>
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>{t(section.titleKey)}</ThemedText>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.filterRow} accessibilityRole="tablist">
              {FILTERS.map((item) => {
                const selected = filter === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.filterTab, selected && styles.filterTabSelected]}
                    onPress={() => setFilter(item.key)}
                    activeOpacity={0.8}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    accessibilityLabel={t(item.labelKey)}
                  >
                    <ThemedText
                      style={[styles.filterLabel, selected && styles.filterLabelSelected]}
                      numberOfLines={2}
                    >
                      {t(item.labelKey)}
                    </ThemedText>
                    <ThemedText style={[styles.filterCount, selected && styles.filterLabelSelected]}>
                      {filterCounts[item.key]}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryPill}>
                <ThemedText style={styles.summaryText}>
                  {filteredNotifications.length}{' '}
                  {filteredNotifications.length === 1
                    ? t('notifications.count.singular')
                    : t('notifications.count.plural')}
                </ThemedText>
              </View>
              <View style={styles.summaryPillUnread}>
                <ThemedText style={styles.summaryTextUnread}>
                  {filteredUnreadCount} {t('notifications.unread')}
                </ThemedText>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="notifications-off-outline"
              title={t('notifications.empty.title')}
              description={t('notifications.empty.description')}
            />
          </View>
        }
        refreshing={refreshing}
        onRefresh={refresh}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
      />
    </ScreenContainer>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    markAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderWidth: 1,
      borderColor: colors.primary + '55',
      backgroundColor: colors.primary + '14',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    markAllText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 28,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 10,
    },
    filterTab: {
      minHeight: 52,
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingHorizontal: 4,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.surface,
    },
    filterTabSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '14',
    },
    filterLabel: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      textAlign: 'center',
    },
    filterLabelSelected: {
      color: colors.primary,
    },
    filterCount: {
      color: colors.textDisabled,
      fontSize: 10,
      fontWeight: '700',
    },
    summaryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 10,
    },
    summaryPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryPillUnread: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.error + '18',
      borderWidth: 1,
      borderColor: colors.error + '55',
    },
    summaryText: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
    },
    summaryTextUnread: {
      fontSize: 12,
      color: colors.error,
      fontWeight: '700',
    },
    sectionHeader: {
      paddingTop: 8,
      paddingBottom: 8,
      backgroundColor: colors.backgroundLight,
    },
    sectionTitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
    itemWrap: {
      marginBottom: 10,
    },
    emptyWrap: {
      minHeight: 280,
    },
  });
