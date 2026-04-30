import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/src/components/themed-text';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

interface DatePickerModalProps {
  visible: boolean;
  selectedDate: string | null;
  title?: string;
  minDate?: string;
  onSelectDate: (date: string) => void;
  onClose: () => void;
}

type CalendarCell = {
  date: string;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
};

const WEEK_LABELS = ['do.', 'lu.', 'ma.', 'mi.', 'ju.', 'vi.', 'sa.'];

const pad = (value: number): string => String(value).padStart(2, '0');

const toDateInput = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseDateInput = (value: string | null): Date => {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const addMonths = (date: Date, offset: number): Date =>
  new Date(date.getFullYear(), date.getMonth() + offset, 1);

const buildCalendar = (year: number, monthIndex: number): CalendarCell[][] => {
  const todayKey = toDateInput(new Date());
  const first = new Date(year, monthIndex, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 6 }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(start);
      date.setDate(start.getDate() + weekIndex * 7 + dayIndex);
      const dateKey = toDateInput(date);

      return {
        date: dateKey,
        day: date.getDate(),
        isCurrentMonth: date.getMonth() === monthIndex,
        isToday: dateKey === todayKey,
      };
    })
  );
};

const formatMonth = (year: number, monthIndex: number): string =>
  new Intl.DateTimeFormat('es-MX', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, monthIndex, 1));

const formatSelectedDate = (date: string | null): string => {
  if (!date) return 'Selecciona una fecha';

  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(parseDateInput(date));
};

export function DatePickerModal({
  visible,
  selectedDate,
  title = 'Seleccionar fecha',
  minDate,
  onSelectDate,
  onClose,
}: DatePickerModalProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const initialDate = useMemo(() => parseDateInput(selectedDate), [selectedDate]);
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
  );
  const calendar = useMemo(
    () => buildCalendar(visibleMonth.getFullYear(), visibleMonth.getMonth()),
    [visibleMonth]
  );
  const monthLabel = formatMonth(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth()
  );
  const minDateValue = minDate ?? toDateInput(new Date());

  const moveMonth = (offset: number) => {
    setVisibleMonth((current) => addMonths(current, offset));
  };

  const handleSelect = (date: string) => {
    if (date < minDateValue) {
      return;
    }

    onSelectDate(date);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.panel}>
          <View style={styles.topRow}>
            <View>
              <ThemedText style={styles.title}>{title}</ThemedText>
              <ThemedText style={styles.selectedLabel}>
                {formatSelectedDate(selectedDate)}
              </ThemedText>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.monthRow}>
            <TouchableOpacity style={styles.navButton} onPress={() => moveMonth(-1)}>
              <Ionicons name="chevron-back" size={19} color={colors.textPrimary} />
            </TouchableOpacity>
            <ThemedText style={styles.monthTitle}>{monthLabel}</ThemedText>
            <TouchableOpacity style={styles.navButton} onPress={() => moveMonth(1)}>
              <Ionicons name="chevron-forward" size={19} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekHeader}>
            {WEEK_LABELS.map((label) => (
              <ThemedText key={label} style={styles.weekLabel}>
                {label}
              </ThemedText>
            ))}
          </View>

          {calendar.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.weekRow}>
              {week.map((cell) => {
                const selected = selectedDate === cell.date;
                const disabled = cell.date < minDateValue;
                return (
                  <TouchableOpacity
                    key={cell.date}
                    style={[
                      styles.dayCell,
                      selected && styles.dayCellSelected,
                      cell.isToday && !selected && styles.dayCellToday,
                      disabled && styles.dayCellDisabled,
                    ]}
                    onPress={() => handleSelect(cell.date)}
                    activeOpacity={disabled ? 1 : 0.75}
                    disabled={disabled}
                  >
                    <ThemedText
                      style={[
                        styles.dayText,
                        !cell.isCurrentMonth && styles.dayTextMuted,
                        disabled && styles.dayTextDisabled,
                        selected && styles.dayTextSelected,
                        cell.isToday && !selected && styles.dayTextToday,
                      ]}
                    >
                      {cell.day}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.overlay,
      padding: 18,
    },
    panel: {
      width: '100%',
      maxWidth: 380,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 14,
      gap: 12,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
    },
    title: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    selectedLabel: {
      marginTop: 2,
      fontSize: 12,
      color: colors.textMuted,
      textTransform: 'capitalize',
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceRaised,
    },
    monthRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
      paddingVertical: 10,
    },
    navButton: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceRaised,
    },
    monthTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary,
      textTransform: 'capitalize',
    },
    weekHeader: {
      flexDirection: 'row',
      gap: 4,
    },
    weekLabel: {
      flex: 1,
      textAlign: 'center',
      fontSize: 11,
      fontWeight: '800',
      color: colors.textMuted,
    },
    weekRow: {
      flexDirection: 'row',
      gap: 4,
    },
    dayCell: {
      flex: 1,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
    },
    dayCellSelected: {
      backgroundColor: colors.primary,
    },
    dayCellToday: {
      backgroundColor: colors.primary + '18',
    },
    dayCellDisabled: {
      opacity: 0.35,
    },
    dayText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    dayTextMuted: {
      color: colors.textDisabled,
    },
    dayTextDisabled: {
      color: colors.textDisabled,
    },
    dayTextSelected: {
      color: colors.onPrimary,
    },
    dayTextToday: {
      color: colors.primary,
    },
  });
