import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import { useUnreadNotificationsCount } from '@/src/hooks/useUnreadNotificationsCount';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

interface NotificationsBadgeProps {
  compact?: boolean;
}

export function NotificationsBadge({ compact = false }: NotificationsBadgeProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { unreadCount } = useUnreadNotificationsCount();

  if (unreadCount <= 0) {
    return compact ? null : (
      <View style={styles.zeroWrap}>
        <ThemedText style={styles.zeroText}>0</ThemedText>
      </View>
    );
  }

  const label = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <View style={[styles.badge, compact && styles.badgeCompact]}>
      <ThemedText style={styles.badgeText}>{label}</ThemedText>
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: 999,
      paddingHorizontal: 6,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.error,
      borderWidth: 1,
      borderColor: colors.backgroundDark,
    },
    badgeCompact: {
      minWidth: 18,
      height: 18,
      paddingHorizontal: 5,
    },
    badgeText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '800',
    },
    zeroWrap: {
      minWidth: 18,
      height: 18,
      borderRadius: 999,
      backgroundColor: colors.surfaceRaised,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    zeroText: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '700',
    },
  });
