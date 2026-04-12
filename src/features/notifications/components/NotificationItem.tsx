import React, { memo, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import {
  AppNotification,
  NOTIFICATION_CATEGORY_LABELS,
} from '@/src/features/notifications/types/notification.types';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

interface NotificationItemProps {
  notification: AppNotification;
  onPress?: (notification: AppNotification) => void;
}

const categoryAccent = (
  colors: AppColorSet,
  category: AppNotification['category']
): string => {
  if (category === 'platform') return colors.primary;
  if (category === 'cleaning') return colors.warning;
  if (category === 'hospitality') return colors.success;
  return colors.info;
};

const formatTimestamp = (seconds: number): string => {
  return new Date(seconds * 1000).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function NotificationItemBase({ notification, onPress }: NotificationItemProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  const accent = useMemo(
    () => categoryAccent(colors, notification.category),
    [colors, notification.category]
  );

  const categoryLabel =
    notification.category && NOTIFICATION_CATEGORY_LABELS[notification.category]
      ? NOTIFICATION_CATEGORY_LABELS[notification.category]
      : 'Asignacion';

  const createdAtLabel = formatTimestamp(notification.createdAt.seconds);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        !notification.read && styles.containerUnread,
        { borderColor: notification.read ? colors.border : accent + '66' },
      ]}
      activeOpacity={0.85}
      onPress={() => onPress?.(notification)}
    >
      <View style={[styles.iconWrap, { backgroundColor: accent + '16' }]}>
        <Ionicons
          name={notification.read ? 'notifications-outline' : 'notifications'}
          size={16}
          color={accent}
        />
      </View>

      <View style={styles.content}>
        <View style={styles.headlineRow}>
          <ThemedText style={styles.title}>{notification.title}</ThemedText>
          {!notification.read ? <View style={[styles.unreadDot, { backgroundColor: accent }]} /> : null}
        </View>

        <ThemedText style={styles.body}>{notification.body}</ThemedText>

        <View style={styles.footerRow}>
          <View style={[styles.categoryChip, { borderColor: accent + '55' }]}>
            <ThemedText style={[styles.categoryChipText, { color: accent }]}>
              {categoryLabel}
            </ThemedText>
          </View>

          <ThemedText style={styles.dateLabel}>{createdAtLabel}</ThemedText>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export const NotificationItem = memo(NotificationItemBase);

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    container: {
      borderWidth: 1,
      borderRadius: 12,
      backgroundColor: colors.surface,
      padding: 12,
      flexDirection: 'row',
      gap: 10,
    },
    containerUnread: {
      backgroundColor: colors.backgroundLight,
    },
    iconWrap: {
      width: 30,
      height: 30,
      borderRadius: 9,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 2,
    },
    content: {
      flex: 1,
      gap: 6,
    },
    headlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
    },
    body: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      flexWrap: 'wrap',
    },
    categoryChip: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: colors.surface,
    },
    categoryChipText: {
      fontSize: 11,
      fontWeight: '700',
    },
    dateLabel: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
    },
  });
