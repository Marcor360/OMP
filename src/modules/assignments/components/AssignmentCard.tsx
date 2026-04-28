import React, { memo, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import {
  Assignment,
  AssignmentCategory,
  ASSIGNMENT_CATEGORY_LABELS,
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_SUBTYPE_LABELS,
} from '@/src/modules/assignments/types/assignment.types';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

interface AssignmentCardProps {
  assignment: Assignment;
  onPress: () => void;
}

const categoryAccent = (colors: AppColorSet, category: AssignmentCategory): string => {
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

const formatDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Sin fecha';

  return parsed.toLocaleDateString('es-MX', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const endOfWeek = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);

  const day = result.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  result.setDate(result.getDate() + daysUntilSunday);

  return result;
};

const isMeetingAssignment = (assignment: Assignment): boolean =>
  Boolean(assignment.meetingId) ||
  assignment.category === 'midweek' ||
  assignment.category === 'weekend';

const isEffectivelyOverdue = (assignment: Assignment): boolean => {
  const parsed = new Date(assignment.date);
  if (Number.isNaN(parsed.getTime())) return false;

  const expiresAt = isMeetingAssignment(assignment) ? endOfWeek(parsed) : parsed;
  return expiresAt.getTime() < Date.now();
};

function AssignmentCardBase({ assignment, onPress }: AssignmentCardProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const effectiveStatus =
    assignment.status === 'overdue' && !isEffectivelyOverdue(assignment)
      ? 'pending'
      : assignment.status;

  const accent = useMemo(
    () => categoryAccent(colors, assignment.category),
    [assignment.category, colors]
  );

  const assignedPeople = useMemo(
    () => assignment.assignedUsers.map((person) => person.name).join(', ') || 'Sin asignar',
    [assignment.assignedUsers]
  );

  const showMeetingMeta =
    assignment.category === 'midweek' || assignment.category === 'weekend';

  return (
    <TouchableOpacity
      style={[styles.card, { borderColor: accent + '55' }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={[styles.accentBar, { backgroundColor: accent }]} />

      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={[styles.categoryBadge, { backgroundColor: accent + '16' }]}>
            <ThemedText style={[styles.categoryBadgeText, { color: accent }]}>
              {ASSIGNMENT_CATEGORY_LABELS[assignment.category]}
            </ThemedText>
          </View>

          {effectiveStatus ? (
            <View style={styles.statusBadge}>
              <ThemedText style={styles.statusBadgeText}>
                {ASSIGNMENT_STATUS_LABELS[effectiveStatus]}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
          <ThemedText style={styles.metaText}>{formatDate(assignment.date)}</ThemedText>
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="business-outline" size={14} color={colors.textMuted} />
          <ThemedText style={styles.metaText} numberOfLines={1}>
            {assignment.congregationId}
          </ThemedText>
        </View>

        {showMeetingMeta ? (
          <View style={styles.metaRowWrap}>
            <View style={styles.metaPill}>
              <ThemedText style={styles.metaPillText}>
                {assignment.meetingType === 'midweek' ? 'Entre semana' : 'Fin de semana'}
              </ThemedText>
            </View>

            {assignment.subType ? (
              <View style={styles.metaPill}>
                <ThemedText style={styles.metaPillText}>
                  {ASSIGNMENT_SUBTYPE_LABELS[assignment.subType]}
                </ThemedText>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.metaRow}>
          <Ionicons name="people-outline" size={14} color={colors.textMuted} />
          <ThemedText style={styles.metaText} numberOfLines={2}>
            {assignedPeople}
          </ThemedText>
        </View>

        {!showMeetingMeta && assignment.notes ? (
          <View style={styles.noteBox}>
            <ThemedText style={styles.noteText} numberOfLines={2}>
              {assignment.notes}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <ThemedText style={[styles.actionText, { color: accent }]}>Ver detalle</ThemedText>
          <Ionicons name="chevron-forward" size={16} color={accent} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export const AssignmentCard = memo(AssignmentCardBase);

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      overflow: 'hidden',
      flexDirection: 'row',
    },
    accentBar: {
      width: 4,
    },
    body: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    categoryBadge: {
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      alignSelf: 'flex-start',
    },
    categoryBadgeText: {
      fontSize: 11,
      fontWeight: '700',
    },
    statusBadge: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: colors.surfaceRaised,
    },
    statusBadgeText: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    metaText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    metaRowWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    metaPill: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: colors.surfaceRaised,
    },
    metaPillText: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
    },
    noteBox: {
      borderRadius: 8,
      backgroundColor: colors.backgroundLight,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    noteText: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 17,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 2,
      marginTop: 2,
    },
    actionText: {
      fontSize: 12,
      fontWeight: '700',
    },
  });
