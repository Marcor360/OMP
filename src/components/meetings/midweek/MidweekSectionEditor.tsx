import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  AssignmentCardEditor,
  AssignmentCardEditorErrors,
} from '@/src/components/meetings/midweek/AssignmentCardEditor';
import { ThemedText } from '@/src/components/themed-text';
import { ActiveCongregationUser } from '@/src/services/users/active-users-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import {
  MidweekMeetingSection,
  createEmptyMidweekAssignment,
  normalizeSectionOrder,
} from '@/src/types/midweek-meeting';

interface MidweekSectionEditorProps {
  section: MidweekMeetingSection;
  users: ActiveCongregationUser[];
  disabled?: boolean;
  onChange: (section: MidweekMeetingSection) => void;
  errors?: Record<string, AssignmentCardEditorErrors>;
}

export function MidweekSectionEditor({
  section,
  users,
  disabled,
  onChange,
  errors,
}: MidweekSectionEditorProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  const updateItems = (items: MidweekMeetingSection['items']) => {
    const normalized = normalizeSectionOrder([
      {
        ...section,
        items,
      },
    ])[0];

    onChange(normalized);
  };

  const addItem = () => {
    const nextItems = [...section.items, createEmptyMidweekAssignment(section.id, section.items.length)];
    updateItems(nextItems);
  };

  return (
    <View style={styles.sectionWrap}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleWrap}>
          <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
          <ThemedText style={styles.sectionSubtitle}>{section.items.length} parte(s)</ThemedText>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={addItem}
          activeOpacity={0.8}
          disabled={disabled}
        >
          <Ionicons name="add" size={16} color="#fff" />
          <ThemedText style={styles.addButtonText}>Agregar parte</ThemedText>
        </TouchableOpacity>
      </View>

      {section.items.length === 0 ? (
        <View style={styles.emptyState}>
          <ThemedText style={styles.emptyText}>Esta seccion aun no tiene partes.</ThemedText>
        </View>
      ) : (
        <View style={styles.itemsList}>
          {section.items.map((item, index) => (
            <AssignmentCardEditor
              key={item.id}
              assignment={item}
              users={users}
              disabled={disabled}
              canMoveUp={index > 0}
              canMoveDown={index < section.items.length - 1}
              errors={errors?.[item.id]}
              onMoveUp={() => {
                if (index === 0) return;

                const next = [...section.items];
                const previous = next[index - 1];
                next[index - 1] = next[index];
                next[index] = previous;
                updateItems(next);
              }}
              onMoveDown={() => {
                if (index >= section.items.length - 1) return;

                const next = [...section.items];
                const following = next[index + 1];
                next[index + 1] = next[index];
                next[index] = following;
                updateItems(next);
              }}
              onRemove={() => {
                const next = section.items.filter((_, currentIndex) => currentIndex !== index);
                updateItems(next);
              }}
              onChange={(nextAssignment) => {
                const next = section.items.map((current) =>
                  current.id === nextAssignment.id ? nextAssignment : current
                );
                updateItems(next);
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    sectionWrap: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      gap: 12,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
    },
    sectionTitleWrap: {
      gap: 2,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textSecondary,
    },
    sectionSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    addButtonText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
    },
    itemsList: {
      gap: 10,
    },
    emptyState: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      borderStyle: 'dashed',
      padding: 12,
      backgroundColor: colors.backgroundLight,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 13,
    },
  });
