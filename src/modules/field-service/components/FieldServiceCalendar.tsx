/**
 * Calendario mensual del Módulo: Contador de Horas de Predicación.
 *
 * - 6 columnas: Lun, Mar, Mié, Jue, Vie, Sáb
 * - Domingo NO aparece (no es día activo en esta versión)
 * - Resalta hoy, día seleccionado y días con registros
 * - Muestra total de minutos de forma compacta si tiene datos
 * - Soporta navegación prev/next mes
 */

import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppColors } from '@/src/styles';
import {
  formatMinutesCompact,
  formatMonthHeader,
  WEEK_HEADER_LABELS,
} from '@/src/modules/field-service/utils/field-service-dates';
import type { CalendarCell, CalendarMonth } from '@/src/modules/field-service/types/field-service.types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface FieldServiceCalendarProps {
  calendar: CalendarMonth;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function FieldServiceCalendar({
  calendar,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: FieldServiceCalendarProps) {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const monthLabel = formatMonthHeader(calendar.year, calendar.month);

  return (
    <View style={styles.container}>
      {/* ── Encabezado de navegación ── */}
      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={onPrevMonth}
          accessibilityLabel="Mes anterior"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.monthTitle}>{monthLabel}</Text>

        <TouchableOpacity
          style={styles.navBtn}
          onPress={onNextMonth}
          accessibilityLabel="Mes siguiente"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── Cabecera de días (Lun–Sáb) ── */}
      <View style={styles.weekHeader}>
        {WEEK_HEADER_LABELS.map((label) => (
          <View key={label} style={styles.headerCell}>
            <Text style={styles.headerText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* ── Semanas ── */}
      {calendar.weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((cell) => (
            <DayCell
              key={cell.date}
              cell={cell}
              isSelected={selectedDate === cell.date}
              onPress={onSelectDate}
              styles={styles}
              colors={colors}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Celda de día ─────────────────────────────────────────────────────────────

interface DayCellProps {
  cell: CalendarCell;
  isSelected: boolean;
  onPress: (date: string) => void;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useAppColors>;
}

const DayCell = React.memo(function DayCell({
  cell,
  isSelected,
  onPress,
  styles,
  colors,
}: DayCellProps) {
  const isDisabled = !cell.isCurrentMonth;
  const compact = formatMinutesCompact(cell.totalMinutes);

  const handlePress = () => {
    if (isDisabled) return;
    onPress(cell.date);
  };

  const cellBg = isSelected
    ? colors.primary
    : cell.isToday
      ? colors.primary + '22'
      : cell.hasEntry
        ? colors.success + '18'
        : 'transparent';

  const dayNumColor = isSelected
    ? '#fff'
    : cell.isToday
      ? colors.primary
      : isDisabled
        ? colors.textDisabled
        : colors.textPrimary;

  const compactColor = isSelected ? '#ffffffCC' : colors.success;

  return (
    <TouchableOpacity
      style={[
        styles.dayCell,
        { backgroundColor: cellBg },
        isSelected && styles.dayCellSelected,
        isDisabled && styles.dayCellDisabled,
      ]}
      onPress={handlePress}
      activeOpacity={isDisabled ? 1 : 0.7}
      accessibilityLabel={`${cell.date}${cell.hasEntry ? `, ${compact}` : ''}`}
      accessibilityState={{ selected: isSelected, disabled: isDisabled }}
    >
      <Text style={[styles.dayNum, { color: dayNumColor }]}>{cell.day}</Text>
      {cell.hasEntry && compact ? (
        <Text style={[styles.dayCompact, { color: compactColor }]}>{compact}</Text>
      ) : cell.isToday && !isSelected ? (
        <View style={[styles.todayDot, { backgroundColor: colors.primary }]} />
      ) : null}
    </TouchableOpacity>
  );
});

// ─── Estilos ──────────────────────────────────────────────────────────────────

const createStyles = (colors: ReturnType<typeof useAppColors>) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      paddingBottom: 8,
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    navBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      textTransform: 'capitalize',
    },
    weekHeader: {
      flexDirection: 'row',
      paddingHorizontal: 4,
      paddingTop: 8,
      paddingBottom: 4,
    },
    headerCell: {
      flex: 1,
      alignItems: 'center',
    },
    headerText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    weekRow: {
      flexDirection: 'row',
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    dayCell: {
      flex: 1,
      height: 52,
      margin: 2,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    dayCellSelected: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 2,
    },
    dayCellDisabled: {
      opacity: 0.3,
    },
    dayNum: {
      fontSize: 14,
      fontWeight: '700',
    },
    dayCompact: {
      fontSize: 9,
      fontWeight: '700',
    },
    todayDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
    },
  });
