import React from 'react';
import { View, StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/src/components/themed-text';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  subtitle?: string;
  style?: ViewStyle;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function StatCard({
  title,
  value,
  icon,
  color,
  subtitle,
  style,
  onPress,
  accessibilityLabel,
}: StatCardProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const iconColor = color ?? colors.primary;

  const content = (
    <>
      <View style={[styles.iconWrap, { backgroundColor: iconColor + '22' }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <ThemedText style={styles.value}>{value}</ThemedText>
      <ThemedText style={styles.title}>{title}</ThemedText>
      {subtitle ? <ThemedText style={styles.subtitle}>{subtitle}</ThemedText> : null}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.card, style]}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? `${title}: ${value}`}
      >
        {content}
        <Ionicons name="chevron-forward" size={16} color={colors.textDisabled} style={styles.chevron} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.card, style]}>
      {content}
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      gap: 4,
      borderWidth: 1,
      borderColor: colors.border,
      minWidth: 140,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    value: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.textPrimary,
      lineHeight: 32,
    },
    title: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    subtitle: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    chevron: {
      position: 'absolute',
      top: 14,
      right: 14,
    },
  });
