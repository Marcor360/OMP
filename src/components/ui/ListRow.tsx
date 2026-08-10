import React, { memo } from 'react';
import { StyleSheet, TouchableOpacity, View, type AccessibilityState } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import { type AppColors, ListLayout, Spacing, Typography, useAppColors } from '@/src/styles';

interface ListRowProps {
  /** Slot izquierdo: Avatar, icono, checkbox, indice. */
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Linea inferior con icono + texto corto (fecha, hora, grupo). */
  meta?: React.ReactNode;
  /** Badges bajo el subtitulo. Usar StatusBadge size="sm". */
  badges?: React.ReactNode;
  /** Slot derecho: chevron, boton de accion, spinner, checkbox. */
  trailing?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** Compacta la fila (usado en selectores y modales). */
  dense?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'checkbox' | 'text';
  accessibilityState?: AccessibilityState;
}

function ListRowBase({
  leading,
  title,
  subtitle,
  meta,
  badges,
  trailing,
  onPress,
  disabled = false,
  dense = false,
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
}: ListRowProps) {
  const colors = useAppColors();
  const styles = createStyles(colors, dense);
  const isInteractive = Boolean(onPress) && !disabled;

  const content = (
    <View style={[styles.container, disabled ? styles.disabled : null]}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.body}>
        <ThemedText style={styles.title} numberOfLines={1}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
        {badges ? <View style={styles.badges}>{badges}</View> : null}
        {meta ? <View style={styles.meta}>{meta}</View> : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );

  if (!isInteractive) {
    return content;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={accessibilityState}
    >
      {content}
    </TouchableOpacity>
  );
}

const createStyles = (colors: AppColors, dense: boolean) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: ListLayout.rowMinHeight,
      paddingVertical: dense ? Spacing.sm : Spacing.md,
      paddingHorizontal: Spacing.lg,
      gap: Spacing.md,
    },
    disabled: {
      opacity: 0.55,
    },
    leading: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      flex: 1,
      justifyContent: 'center',
      gap: 2,
    },
    title: {
      ...Typography.rowTitle,
      color: colors.textPrimary,
    },
    subtitle: {
      ...Typography.rowSubtitle,
      color: colors.textMuted,
    },
    badges: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: 2,
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: 2,
    },
    trailing: {
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export const ListRow = memo(ListRowBase);
export type { ListRowProps };
