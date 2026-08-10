import React, { memo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/src/components/themed-text';
import { type AppColors, Radius, Spacing, Typography, useAppColors } from '@/src/styles';

interface EntityMeta {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}

interface EntityCardProps {
  /** Barra de acento izquierda + tinte del borde. Deriva del dominio. */
  accent?: string;
  title: string;
  subtitle?: string;
  /** Badges superiores: categoria, estado. Usar StatusBadge. */
  badges?: React.ReactNode;
  /** Filas de metadatos con icono. Maximo 4. */
  meta?: EntityMeta[];
  /** Zona inferior: participantes, contadores, acciones. */
  footer?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}

function EntityCardBase({
  accent,
  title,
  subtitle,
  badges,
  meta,
  footer,
  onPress,
  accessibilityLabel,
}: EntityCardProps) {
  const colors = useAppColors();
  const styles = createStyles(colors, accent);

  const content = (
    <View style={styles.card}>
      {accent ? <View style={styles.accentBar} /> : null}
      <View style={styles.body}>
        {badges ? <View style={styles.badges}>{badges}</View> : null}
        <ThemedText style={styles.title} numberOfLines={2}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </ThemedText>
        ) : null}
        {meta && meta.length > 0 ? (
          <View style={styles.metaList}>
            {meta.slice(0, 4).map((item) => (
              <View key={`${item.icon}-${item.text}`} style={styles.metaRow}>
                <Ionicons name={item.icon} size={14} color={colors.textMuted} />
                <ThemedText style={styles.metaText} numberOfLines={1}>
                  {item.text}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
    >
      {content}
    </TouchableOpacity>
  );
}

const createStyles = (colors: AppColors, accent?: string) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: accent ? `${accent}55` : colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    accentBar: {
      width: 4,
      backgroundColor: accent,
    },
    body: {
      flex: 1,
      padding: Spacing.lg,
      gap: 4,
    },
    badges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
      marginBottom: 2,
    },
    title: {
      ...Typography.sectionTitle,
      color: colors.textPrimary,
    },
    subtitle: {
      ...Typography.rowSubtitle,
      color: colors.textMuted,
    },
    metaList: {
      gap: 4,
      marginTop: Spacing.xs,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    metaText: {
      ...Typography.meta,
      color: colors.textMuted,
      flexShrink: 1,
    },
    footer: {
      marginTop: Spacing.sm,
    },
  });

export const EntityCard = memo(EntityCardBase);
export type { EntityCardProps, EntityMeta };
