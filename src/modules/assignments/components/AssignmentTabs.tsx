import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import { AssignmentTab } from '@/src/modules/assignments/types/assignment.types';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { useI18n } from '@/src/i18n';

const TABS: AssignmentTab[] = [
  'all',
  'midweek',
  'weekend',
  'cleaning',
  'hospitality',
];

interface AssignmentTabsProps {
  activeTab: AssignmentTab;
  onChange: (next: AssignmentTab) => void;
}

export function AssignmentTabs({ activeTab, onChange }: AssignmentTabsProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { t } = useI18n();

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = tab === activeTab;

        return (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onChange(tab)}
            activeOpacity={0.85}
          >
            <ThemedText style={[styles.tabText, isActive && styles.tabTextActive]}>
              {t(`assignments.categories.${tab}`)}
            </ThemedText>
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
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    tab: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.surface,
    },
    tabActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '18',
    },
    tabText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    tabTextActive: {
      color: colors.primary,
    },
  });
