import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/src/components/themed-text';
import {
  StatusBadge,
  assignmentStatusColor,
  priorityColor,
} from '@/src/components/common/StatusBadge';
import { AppColors } from '@/src/constants/app-colors';
import {
  Assignment,
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_PRIORITY_LABELS,
} from '@/src/types/assignment';
import { formatDate, isOverdue } from '@/src/utils/dates/dates';

interface AssignmentCardProps {
  assignment: Assignment;
  onPress?: () => void;
}

const priorityIcon: Record<string, keyof typeof Ionicons.glyphMap> = {
  low: 'arrow-down-outline',
  medium: 'remove-outline',
  high: 'arrow-up-outline',
  critical: 'flash-outline',
};

export function AssignmentCard({ assignment, assignment: a, onPress }: AssignmentCardProps) {
  const router = useRouter();
  const overdue = isOverdue(a.dueDate) && a.status === 'pending';

  const handlePress = () => {
    if (onPress) onPress();
    else router.push(`/(protected)/assignments/${a.id}` as any);
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.8}>
      {/* Priority strip */}
      <View
        style={[styles.priorityStrip, { backgroundColor: priorityColor[a.priority] }]}
      />

      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={[styles.priorityIcon, { backgroundColor: priorityColor[a.priority] + '22' }]}>
            <Ionicons
              name={priorityIcon[a.priority] ?? 'remove-outline'}
              size={14}
              color={priorityColor[a.priority]}
            />
          </View>
          <ThemedText style={styles.priority}>
            {ASSIGNMENT_PRIORITY_LABELS[a.priority]}
          </ThemedText>
          <View style={styles.spacer} />
          <StatusBadge
            label={ASSIGNMENT_STATUS_LABELS[a.status]}
            color={assignmentStatusColor[a.status]}
            size="sm"
          />
        </View>

        <ThemedText style={styles.title} numberOfLines={2}>
          {a.title}
        </ThemedText>

        <View style={styles.footer}>
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={12} color={AppColors.textMuted} />
            <ThemedText style={styles.meta} numberOfLines={1}>
              {a.assignedToName}
            </ThemedText>
          </View>
          <View style={styles.metaRow}>
            <Ionicons
              name="calendar-outline"
              size={12}
              color={overdue ? AppColors.error : AppColors.textMuted}
            />
            <ThemedText
              style={[styles.meta, overdue && { color: AppColors.error }]}
            >
              {overdue ? '¡Vencida! ' : ''}{formatDate(a.dueDate)}
            </ThemedText>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  priorityStrip: {
    width: 4,
    borderRadius: 2,
  },
  body: {
    flex: 1,
    padding: 14,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priority: {
    fontSize: 11,
    fontWeight: '600',
    color: AppColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  spacer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.textPrimary,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  meta: {
    fontSize: 12,
    color: AppColors.textMuted,
  },
});
