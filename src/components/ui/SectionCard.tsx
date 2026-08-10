import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import { type AppColors, Radius, Spacing, Typography, useAppColors } from '@/src/styles';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  /** Slot derecho del encabezado: boton, enlace, contador. */
  action?: React.ReactNode;
  children: React.ReactNode;
  /** Aplica padding interno estandar. Default true. */
  padded?: boolean;
}

function SectionCardBase({ title, subtitle, action, children, padded = true }: SectionCardProps) {
  const colors = useAppColors();
  const styles = createStyles(colors, padded);
  const hasHeader = Boolean(title || subtitle || action);

  return (
    <View style={styles.card}>
      {hasHeader ? (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {title ? <ThemedText style={styles.title}>{title}</ThemedText> : null}
            {subtitle ? <ThemedText style={styles.subtitle}>{subtitle}</ThemedText> : null}
          </View>
          {action ? <View style={styles.action}>{action}</View> : null}
        </View>
      ) : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const createStyles = (colors: AppColors, padded: boolean) =>
  StyleSheet.create({
    card: {
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.sm,
      gap: Spacing.md,
    },
    headerText: {
      flex: 1,
      gap: 2,
    },
    title: {
      ...Typography.sectionTitle,
      color: colors.textPrimary,
    },
    subtitle: {
      ...Typography.rowSubtitle,
      color: colors.textMuted,
    },
    action: {
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    body: {
      paddingHorizontal: padded ? Spacing.lg : 0,
      paddingBottom: padded ? Spacing.lg : 0,
    },
  });

export const SectionCard = memo(SectionCardBase);
export type { SectionCardProps };
