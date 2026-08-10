import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/src/components/themed-text';
import { type AppColors, Spacing, Typography, useAppColors } from '@/src/styles';

interface InfoRowProps {
  label: string;
  value: string;
  multiline?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}

function InfoRowBase({ label, value, multiline = false, icon }: InfoRowProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        {icon ? <Ionicons name={icon} size={14} color={colors.textMuted} /> : null}
        <ThemedText style={styles.label}>{label}</ThemedText>
      </View>
      <ThemedText style={styles.value} numberOfLines={multiline ? undefined : 1}>
        {value}
      </ThemedText>
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    container: {
      gap: 2,
      paddingVertical: Spacing.sm,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    label: {
      ...Typography.meta,
      color: colors.textMuted,
    },
    value: {
      ...Typography.rowTitle,
      color: colors.textPrimary,
    },
  });

export const InfoRow = memo(InfoRowBase);
export type { InfoRowProps };
