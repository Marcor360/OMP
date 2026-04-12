import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/src/components/themed-text';
import { StatusBadge, assignmentStatusColor, priorityColor } from '@/src/components/common/StatusBadge';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { Assignment, ASSIGNMENT_PRIORITY_LABELS, ASSIGNMENT_STATUS_LABELS } from '@/src/types/assignment';
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

export function AssignmentCard({ assignment, onPress }: AssignmentCardProps) {
  const router = useRouter();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const overdue = isOverdue(assignment.dueDate) && assignment.status === 'pending';

  const handlePress = () => {
    if (onPress) onPress();
    else {
      const query = assignment.meetingId
        ? `?meetingId=${encodeURIComponent(assignment.meetingId)}`
        : '';
      router.push(`/(protected)/assignments/${assignment.id}${query}` as any);
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.8}>
      <View style={[styles.priorityStrip, { backgroundColor: priorityColor[assignment.priority] }]} />

      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={[styles.priorityIcon, { backgroundColor: priorityColor[assignment.priority] + '22' }]}>
            <Ionicons
              name={priorityIcon[assignment.priority] ?? 'remove-outline'}
              size={14}
              color={priorityColor[assignment.priority]}
            />
          </View>
          <ThemedText style={styles.priority}>{ASSIGNMENT_PRIORITY_LABELS[assignment.priority]}</ThemedText>
          <View style={styles.spacer} />
          <StatusBadge
            label={ASSIGNMENT_STATUS_LABELS[assignment.status]}
            color={assignmentStatusColor[assignment.status]}
            size="sm"
          />
        </View>

        <ThemedText style={styles.title} numberOfLines={2}>
          {assignment.title}
        </ThemedText>

        <View style={styles.footer}>
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={12} color={colors.textMuted} />
            <ThemedText style={styles.meta} numberOfLines={1}>
              {assignment.assignedToName}
            </ThemedText>
          </View>
          <View style={styles.metaRow}>
            <Ionicons
              name="calendar-outline"
              size={12}
              color={overdue ? colors.error : colors.textMuted}
            />
            <ThemedText style={[styles.meta, overdue && { color: colors.error }]}>
              {overdue ? 'Vencida: ' : ''}
              {formatDate(assignment.dueDate)}
            </ThemedText>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      overflow: 'hidden',
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: colors.border,
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
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    spacer: {
      flex: 1,
    },
    title: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
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
      color: colors.textMuted,
    },
  });
