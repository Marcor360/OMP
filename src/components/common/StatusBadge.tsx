import React, { useMemo } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/src/components/themed-text';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

interface StatusBadgeProps {
  label: string;
  color?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export function StatusBadge({
  label,
  color,
  icon,
  size = 'md',
  style,
}: StatusBadgeProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const isSmall = size === 'sm';
  const badgeColor = color ?? colors.textMuted;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: badgeColor + '22',
          borderColor: badgeColor + '55',
        },
        isSmall && styles.badgeSm,
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={isSmall ? 10 : 12} color={badgeColor} /> : null}
      <ThemedText style={[styles.label, { color: badgeColor }, isSmall && styles.labelSm]}>{label}</ThemedText>
    </View>
  );
}

export interface StatusColorMaps {
  meetingStatusColor: Record<string, string>;
  assignmentStatusColor: Record<string, string>;
  priorityColor: Record<string, string>;
  userStatusColor: Record<string, string>;
  roleColor: Record<string, string>;
}

/** Colores de estado derivados del tema activo. */
export function useStatusColors(): StatusColorMaps {
  const colors = useAppColors();
  return useMemo(
    () => ({
      meetingStatusColor: {
        pending: colors.textMuted,
        scheduled: colors.info,
        in_progress: colors.warning,
        completed: colors.success,
        cancelled: colors.error,
      },
      assignmentStatusColor: {
        pending: colors.warning,
        in_progress: colors.info,
        completed: colors.success,
        cancelled: colors.textMuted,
        overdue: colors.error,
      },
      priorityColor: {
        low: colors.priorityLow,
        medium: colors.priorityMedium,
        high: colors.priorityHigh,
        critical: colors.priorityCritical,
      },
      userStatusColor: {
        active: colors.success,
        inactive: colors.textMuted,
        suspended: colors.error,
      },
      roleColor: {
        admin: colors.roleAdmin,
        supervisor: colors.roleSupervisor,
        user: colors.roleUser,
      },
    }),
    [colors]
  );
}

const createStyles = (_colors: AppColorSet) =>
  StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 100,
      borderWidth: 1,
      alignSelf: 'flex-start',
    },
    badgeSm: {
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 16,
    },
    labelSm: {
      fontSize: 10,
    },
  });
