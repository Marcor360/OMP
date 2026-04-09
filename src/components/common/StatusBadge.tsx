import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { ThemedText } from '@/src/components/themed-text';
import { AppColors } from '@/src/constants/app-colors';
import { Ionicons } from '@expo/vector-icons';

interface StatusBadgeProps {
  label: string;
  color?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export function StatusBadge({
  label,
  color = AppColors.textMuted,
  icon,
  size = 'md',
  style,
}: StatusBadgeProps) {
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: color + '22',
          borderColor: color + '55',
        },
        isSmall && styles.badgeSm,
        style,
      ]}
    >
      {icon ? (
        <Ionicons name={icon} size={isSmall ? 10 : 12} color={color} />
      ) : null}
      <ThemedText
        style={[styles.label, { color }, isSmall && styles.labelSm]}
      >
        {label}
      </ThemedText>
    </View>
  );
}

// ── Colores por estado estandarizados ──────────────────────────────────────

export const meetingStatusColor: Record<string, string> = {
  scheduled: AppColors.info,
  in_progress: AppColors.warning,
  completed: AppColors.success,
  cancelled: AppColors.error,
};

export const assignmentStatusColor: Record<string, string> = {
  pending: AppColors.warning,
  in_progress: AppColors.info,
  completed: AppColors.success,
  cancelled: AppColors.textMuted,
  overdue: AppColors.error,
};

export const priorityColor: Record<string, string> = {
  low: AppColors.priorityLow,
  medium: AppColors.priorityMedium,
  high: AppColors.priorityHigh,
  critical: AppColors.priorityCritical,
};

export const userStatusColor: Record<string, string> = {
  active: AppColors.success,
  inactive: AppColors.textMuted,
  suspended: AppColors.error,
};

export const roleColor: Record<string, string> = {
  admin: AppColors.roleAdmin,
  supervisor: AppColors.roleSupervisor,
  user: AppColors.roleUser,
};

const styles = StyleSheet.create({
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
