import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import {
  Assignment,
  ASSIGNMENT_CATEGORY_LABELS,
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_SUBTYPE_LABELS,
} from '@/src/modules/assignments/types/assignment.types';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { type I18nContextType, useI18n } from '@/src/i18n';

interface AssignmentDetailSectionProps {
  assignment: Assignment;
}

const formatDate = (value: string, t: I18nContextType['t']): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return t('assignments.detailSection.noDate');

  return parsed.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function AssignmentDetailSection({ assignment }: AssignmentDetailSectionProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { t } = useI18n();

  const assignedPeople = useMemo(
    () => assignment.assignedUsers.map((person) => person.name).join(', ') || t('assignments.detailSection.unassigned'),
    [assignment.assignedUsers, t]
  );

  const showMeetingMeta =
    assignment.category === 'midweek' || assignment.category === 'weekend';

  return (
    <View style={styles.container}>
      <InfoRow label={t('assignments.detailSection.category')} value={ASSIGNMENT_CATEGORY_LABELS[assignment.category]} />
      <InfoRow label={t('assignments.detailSection.date')} value={formatDate(assignment.date, t)} />
      <InfoRow label={t('assignments.detailSection.congregation')} value={assignment.congregationId} />
      <InfoRow label={t('assignments.detailSection.assignedPeople')} value={assignedPeople} />

      {showMeetingMeta ? (
        <>
          <InfoRow
            label={t('assignments.detailSection.meetingType')}
            value={assignment.meetingType === 'midweek' ? t('assignments.detailSection.meetingTypeMidweek') : t('assignments.detailSection.meetingTypeWeekend')}
          />
          <InfoRow
            label={t('assignments.detailSection.subType')}
            value={
              assignment.subType
                ? ASSIGNMENT_SUBTYPE_LABELS[assignment.subType]
                : t('assignments.detailSection.noSubType')
            }
          />
        </>
      ) : null}

      {!showMeetingMeta ? (
        <InfoRow label={t('assignments.detailSection.notes')} value={assignment.notes ?? t('assignments.detailSection.noNotes')} multiline />
      ) : null}

      {assignment.status ? (
        <InfoRow label={t('assignments.detailSection.status')} value={ASSIGNMENT_STATUS_LABELS[assignment.status]} />
      ) : null}

      {assignment.title ? <InfoRow label={t('assignments.detailSection.title')} value={assignment.title} multiline /> : null}

      {assignment.createdAt ? (
        <InfoRow label={t('assignments.detailSection.createdAt')} value={formatDate(assignment.createdAt, t)} />
      ) : null}

      {assignment.updatedAt ? (
        <InfoRow label={t('assignments.detailSection.updatedAt')} value={formatDate(assignment.updatedAt, t)} />
      ) : null}
    </View>
  );
}

function InfoRow({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.row}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <ThemedText style={[styles.value, multiline && styles.valueMultiline]}>{value}</ThemedText>
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    container: {
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      backgroundColor: colors.surface,
    },
    row: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 4,
    },
    label: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
    },
    value: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: '500',
    },
    valueMultiline: {
      lineHeight: 20,
    },
  });
