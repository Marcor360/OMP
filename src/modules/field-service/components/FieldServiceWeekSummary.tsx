/**
 * Componente de resumen semanal.
 * Módulo: Contador de Horas de Predicación.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppColors } from '@/src/styles';
import { formatMinutes, parseLocalDate } from '@/src/modules/field-service/utils/field-service-dates';
import type { WeekSummary } from '@/src/modules/field-service/types/field-service.types';

interface FieldServiceWeekSummaryProps {
  summary: WeekSummary;
}

export function FieldServiceWeekSummary({ summary }: FieldServiceWeekSummaryProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  const weekStartDate = summary.weekStart
    ? parseLocalDate(summary.weekStart).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'short',
      })
    : '';
  const weekEndDate = summary.weekEnd
    ? parseLocalDate(summary.weekEnd).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'short',
      })
    : '';

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="calendar-outline" size={18} color={colors.accent} />
      </View>
      <View style={styles.info}>
        <Text style={styles.label}>
          Semana {weekStartDate} – {weekEndDate}
        </Text>
        <Text style={styles.total}>
          {formatMinutes(summary.totalMinutes)}
        </Text>
      </View>
      <View style={styles.daysInfo}>
        <Text style={styles.daysCount}>
          {summary.days.length} día{summary.days.length !== 1 ? 's' : ''}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useAppColors>) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.accent + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: {
      flex: 1,
    },
    label: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
    },
    total: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
      marginTop: 2,
    },
    daysInfo: {
      alignItems: 'flex-end',
    },
    daysCount: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
    },
  });
