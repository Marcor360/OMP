import React, { useMemo } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import {
  AssignmentCategory,
  AssignmentFilters as AssignmentFilterValues,
  ASSIGNMENT_CATEGORY_LABELS,
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_SUBTYPE_LABELS,
} from '@/src/modules/assignments/types/assignment.types';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

interface AssignmentFiltersProps {
  filters: AssignmentFilterValues;
  activeTab: AssignmentCategory;
  onUpdate: <K extends keyof AssignmentFilterValues>(
    key: K,
    value: AssignmentFilterValues[K]
  ) => void;
  onSelectCategory: (category: AssignmentCategory) => void;
  onReset: () => void;
}

const CATEGORY_FILTERS: AssignmentCategory[] = [
  'midweek',
  'weekend',
  'cleaning',
  'hospitality',
];

const STATUS_FILTERS = ['all', 'pending', 'assigned', 'in_progress', 'completed'] as const;

const SUBTYPE_FILTERS = ['all', 'microphone', 'platform'] as const;

export function AssignmentFilters({
  filters,
  activeTab,
  onUpdate,
  onSelectCategory,
  onReset,
}: AssignmentFiltersProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  const showSubType = useMemo(
    () => activeTab === 'midweek' || activeTab === 'weekend',
    [activeTab]
  );

  return (
    <View style={styles.container}>
      <View style={styles.rowBetween}>
        <ThemedText style={styles.title}>Filtros</ThemedText>
        <TouchableOpacity style={styles.resetButton} onPress={onReset} activeOpacity={0.8}>
          <ThemedText style={styles.resetText}>Limpiar</ThemedText>
        </TouchableOpacity>
      </View>

      <Field label="Fecha exacta (AAAA-MM-DD)">
        <TextInput
          style={styles.input}
          value={filters.exactDate}
          onChangeText={(value) => onUpdate('exactDate', value)}
          placeholder="2026-04-12"
          placeholderTextColor={colors.textDisabled}
        />
      </Field>

      <View style={styles.inlineFields}>
        <View style={styles.inlineItem}>
          <Field label="Desde">
            <TextInput
              style={styles.input}
              value={filters.rangeStart}
              onChangeText={(value) => onUpdate('rangeStart', value)}
              placeholder="2026-04-01"
              placeholderTextColor={colors.textDisabled}
            />
          </Field>
        </View>

        <View style={styles.inlineItem}>
          <Field label="Hasta">
            <TextInput
              style={styles.input}
              value={filters.rangeEnd}
              onChangeText={(value) => onUpdate('rangeEnd', value)}
              placeholder="2026-04-30"
              placeholderTextColor={colors.textDisabled}
            />
          </Field>
        </View>
      </View>

      <Field label="Categoria">
        <View style={styles.chipRow}>
          {CATEGORY_FILTERS.map((category) => {
            const selected = activeTab === category;

            return (
              <TouchableOpacity
                key={category}
                style={[styles.chip, selected && styles.chipActive]}
                onPress={() => onSelectCategory(category)}
                activeOpacity={0.8}
              >
                <ThemedText style={[styles.chipText, selected && styles.chipTextActive]}>
                  {ASSIGNMENT_CATEGORY_LABELS[category]}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>
      </Field>

      {showSubType ? (
        <Field label="Subtipo (solo reuniones)">
          <View style={styles.chipRow}>
            {SUBTYPE_FILTERS.map((subType) => {
              const selected = filters.subType === subType;
              const label =
                subType === 'all' ? 'Todos' : ASSIGNMENT_SUBTYPE_LABELS[subType];

              return (
                <TouchableOpacity
                  key={subType}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => onUpdate('subType', subType)}
                  activeOpacity={0.8}
                >
                  <ThemedText style={[styles.chipText, selected && styles.chipTextActive]}>
                    {label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        </Field>
      ) : null}

      <Field label="Persona asignada">
        <TextInput
          style={styles.input}
          value={filters.assignedPerson}
          onChangeText={(value) => onUpdate('assignedPerson', value)}
          placeholder="Buscar por nombre"
          placeholderTextColor={colors.textDisabled}
        />
      </Field>

      <Field label="Congregacion">
        <TextInput
          style={styles.input}
          value={filters.congregationId}
          onChangeText={(value) => onUpdate('congregationId', value)}
          placeholder="ID de congregacion"
          placeholderTextColor={colors.textDisabled}
          autoCapitalize="none"
        />
      </Field>

      <Field label="Estado (opcional)">
        <View style={styles.chipRow}>
          {STATUS_FILTERS.map((status) => {
            const selected = filters.status === status;
            const label =
              status === 'all' ? 'Todos' : ASSIGNMENT_STATUS_LABELS[status];

            return (
              <TouchableOpacity
                key={status}
                style={[styles.chip, selected && styles.chipActive]}
                onPress={() => onUpdate('status', status)}
                activeOpacity={0.8}
              >
                <ThemedText style={[styles.chipText, selected && styles.chipTextActive]}>
                  {label}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>
      </Field>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.field}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      {children}
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    container: {
      marginHorizontal: 16,
      marginTop: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 12,
      gap: 12,
    },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: 15,
      color: colors.textSecondary,
      fontWeight: '700',
    },
    resetButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
    },
    resetText: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
    },
    field: {
      gap: 6,
    },
    label: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.backgroundLight,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.textPrimary,
      fontSize: 14,
    },
    inlineFields: {
      flexDirection: 'row',
      gap: 8,
    },
    inlineItem: {
      flex: 1,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
    },
    chipTextActive: {
      color: '#fff',
    },
  });
