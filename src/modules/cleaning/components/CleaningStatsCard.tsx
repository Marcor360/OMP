import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppColors } from '@/src/styles';

interface CleaningStatsCardProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: number;
  color?: string;
}

/** Tarjeta de estadística individual del dashboard de limpieza. */
export function CleaningStatsCard({
  icon,
  label,
  value,
  color,
}: CleaningStatsCardProps) {
  const colors = useAppColors();

  const cardColor = color ?? colors.primary;

  const styles = StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    iconWrapper: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${cardColor}20`,
    },
    value: {
      fontSize: 26,
      fontWeight: '700',
      color: cardColor,
      lineHeight: 30,
    },
    label: {
      fontSize: 11,
      fontWeight: '500',
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 14,
    },
  });

  return (
    <View style={styles.card}>
      <View style={styles.iconWrapper}>
        <Ionicons name={icon} size={22} color={cardColor} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}
