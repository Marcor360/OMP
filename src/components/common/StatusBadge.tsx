import React from 'react';
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

export const meetingStatusColor: Record<string, string> = {
  pending: '#6B7280',
  scheduled: '#2563EB',
  in_progress: '#D97706',
  completed: '#16A34A',
  cancelled: '#DC2626',
};

export const assignmentStatusColor: Record<string, string> = {
  pending: '#D97706',
  in_progress: '#2563EB',
  completed: '#16A34A',
  cancelled: '#6B7280',
  overdue: '#DC2626',
};

export const priorityColor: Record<string, string> = {
  low: '#6B7280',
  medium: '#D97706',
  high: '#DC2626',
  critical: '#7C3AED',
};

export const userStatusColor: Record<string, string> = {
  active: '#16A34A',
  inactive: '#6B7280',
  suspended: '#DC2626',
};

export const roleColor: Record<string, string> = {
  admin: '#1E40AF',
  supervisor: '#0284C7',
  user: '#16A34A',
};

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
