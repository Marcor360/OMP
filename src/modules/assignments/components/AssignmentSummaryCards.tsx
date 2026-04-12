import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import {
  AssignmentCategory,
  AssignmentSummary,
  ASSIGNMENT_CATEGORY_LABELS,
} from '@/src/modules/assignments/types/assignment.types';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

const CATEGORY_ORDER: AssignmentCategory[] = [
  'midweek',
  'weekend',
  'cleaning',
  'hospitality',
];

const CATEGORY_ICON: Record<AssignmentCategory, keyof typeof Ionicons.glyphMap> = {
  midweek: 'book-outline',
  weekend: 'calendar-outline',
  cleaning: 'sparkles-outline',
  hospitality: 'people-outline',
};

const CATEGORY_ACCENT = (
  colors: AppColorSet,
  category: AssignmentCategory
): string => {
  switch (category) {
    case 'midweek':
      return colors.info;
    case 'weekend':
      return colors.primary;
    case 'cleaning':
      return colors.warning;
    case 'hospitality':
      return colors.success;
    default:
      return colors.primary;
  }
};

interface AssignmentSummaryCardsProps {
  summary: AssignmentSummary;
  activeTab: AssignmentCategory;
  onSelect: (category: AssignmentCategory) => void;
}

export function AssignmentSummaryCards({
  summary,
  activeTab,
  onSelect,
}: AssignmentSummaryCardsProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      {CATEGORY_ORDER.map((category) => {
        const accent = CATEGORY_ACCENT(colors, category);
        const selected = category === activeTab;

        return (
          <TouchableOpacity
            key={category}
            style={[
              styles.card,
              { borderColor: selected ? accent : colors.border },
              selected && { backgroundColor: accent + '14' },
            ]}
            onPress={() => onSelect(category)}
            activeOpacity={0.9}
          >
            <View style={[styles.iconWrap, { backgroundColor: accent + '18' }]}>
              <Ionicons name={CATEGORY_ICON[category]} size={16} color={accent} />
            </View>

            <View style={styles.textWrap}>
              <ThemedText style={styles.label}>{ASSIGNMENT_CATEGORY_LABELS[category]}</ThemedText>
              <ThemedText style={[styles.count, { color: accent }]}>
                {summary[category]}
              </ThemedText>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    card: {
      minWidth: '47%',
      flexGrow: 1,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    iconWrap: {
      width: 28,
      height: 28,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    textWrap: {
      flex: 1,
      gap: 2,
    },
    label: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
    },
    count: {
      fontSize: 20,
      fontWeight: '800',
      lineHeight: 22,
    },
  });
