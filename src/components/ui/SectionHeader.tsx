import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import { type AppColors, Spacing, Typography, useAppColors } from '@/src/styles';

interface SectionHeaderProps {
  title: string;
  /** Numero entre parentesis junto al titulo. */
  count?: number;
  /** Texto auxiliar a la derecha (ej. "ver todo"). */
  hint?: string;
  /** Slot de accion a la derecha, tiene prioridad sobre `hint`. */
  action?: React.ReactNode;
}

function SectionHeaderBase({ title, count, hint, action }: SectionHeaderProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <ThemedText style={styles.title} numberOfLines={1}>
        {title}
        {typeof count === 'number' ? ` (${count})` : ''}
      </ThemedText>
      {action ? (
        <View style={styles.action}>{action}</View>
      ) : hint ? (
        <ThemedText style={styles.hint}>{hint}</ThemedText>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
    },
    title: {
      ...Typography.sectionTitle,
      color: colors.textPrimary,
      flex: 1,
    },
    hint: {
      ...Typography.meta,
      color: colors.primary,
    },
    action: {
      alignItems: 'flex-end',
    },
  });

export const SectionHeader = memo(SectionHeaderBase);
export type { SectionHeaderProps };
