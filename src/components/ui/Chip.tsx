import React, { memo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/src/components/themed-text';
import { type AppColors, Radius, Spacing, Typography, useAppColors } from '@/src/styles';

interface ChipProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  tone?: string;
  onPress?: () => void;
  disabled?: boolean;
}

function ChipBase({ label, icon, active = false, tone, onPress, disabled = false }: ChipProps) {
  const colors = useAppColors();
  const accent = tone ?? colors.primary;
  const styles = createStyles(colors, accent, active);

  const content = (
    <View style={[styles.chip, disabled ? styles.disabled : null]}>
      {icon ? <Ionicons name={icon} size={13} color={active ? accent : colors.textMuted} /> : null}
      <ThemedText style={styles.label}>{label}</ThemedText>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      accessibilityLabel={label}
    >
      {content}
    </TouchableOpacity>
  );
}

const createStyles = (colors: AppColors, accent: string, active: boolean) =>
  StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: active ? accent : colors.border,
      backgroundColor: active ? `${accent}1A` : colors.surface,
    },
    disabled: {
      opacity: 0.5,
    },
    label: {
      ...Typography.meta,
      color: active ? accent : colors.textSecondary,
    },
  });

export const Chip = memo(ChipBase);
export type { ChipProps };
