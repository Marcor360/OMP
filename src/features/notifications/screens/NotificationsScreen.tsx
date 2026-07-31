import React, { useCallback } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { EmptyState } from '@/src/components/common/EmptyState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { NotificationItem } from '@/src/features/notifications/components/NotificationItem';
import { AppNotification } from '@/src/features/notifications/types/notification.types';
import { resolveNotificationHref } from '@/src/features/notifications/utils/notification-routes';
import { useNotifications } from '@/src/hooks/useNotifications';
import { useI18n } from '@/src/i18n/index';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { getSafeNotificationHref } from '@/src/utils/navigation/redirect';

const resolveAssignmentHref = (notification: AppNotification): Href =>
  getSafeNotificationHref(
    notification.data?.url ?? resolveNotificationHref(notification)
  ) as Href;

export function NotificationsScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { t } = useI18n();

  const {
    notifications,
    loading,
    refreshing,
    error,
    refresh,
    markRead,
    markAllRead,
  } = useNotifications();

  const unreadCount = notifications.filter((item) => !item.read).length;

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

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationItem notification={item} onPress={onPressItem} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.summaryRow}>
            <View style={styles.summaryPill}>
              <ThemedText style={styles.summaryText}>
                {notifications.length}{' '}
                {notifications.length === 1
                  ? t('notifications.count.singular')
                  : t('notifications.count.plural')}
              </ThemedText>
            </View>
            <View style={styles.summaryPillUnread}>
              <ThemedText style={styles.summaryTextUnread}>
                {unreadCount} {t('notifications.unread')}
              </ThemedText>
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
    separator: {
      height: 10,
    },
    emptyWrap: {
      minHeight: 280,
    },
  });
