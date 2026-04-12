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

interface AssignmentDetailSectionProps {
  assignment: Assignment;
}

const formatDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Sin fecha';

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

  const assignedPeople = useMemo(
    () => assignment.assignedUsers.map((person) => person.name).join(', ') || 'Sin asignar',
    [assignment.assignedUsers]
  );

  const showMeetingMeta =
    assignment.category === 'midweek' || assignment.category === 'weekend';

  return (
    <View style={styles.container}>
      <InfoRow label="Categoria" value={ASSIGNMENT_CATEGORY_LABELS[assignment.category]} />
      <InfoRow label="Fecha" value={formatDate(assignment.date)} />
      <InfoRow label="Congregacion" value={assignment.congregationId} />
      <InfoRow label="Personas asignadas" value={assignedPeople} />

      {showMeetingMeta ? (
        <>
          <InfoRow
            label="Tipo de reunion"
            value={assignment.meetingType === 'midweek' ? 'Entre semana' : 'Fin de semana'}
          />
          <InfoRow
            label="Subtipo"
            value={
              assignment.subType
                ? ASSIGNMENT_SUBTYPE_LABELS[assignment.subType]
                : 'Sin subtipo'
            }
          />
        </>
      ) : null}

      {!showMeetingMeta ? (
        <InfoRow label="Notas" value={assignment.notes ?? 'Sin notas'} multiline />
      ) : null}

      {assignment.status ? (
        <InfoRow label="Estado" value={ASSIGNMENT_STATUS_LABELS[assignment.status]} />
      ) : null}

      {assignment.title ? <InfoRow label="Titulo" value={assignment.title} multiline /> : null}

      {assignment.createdAt ? (
        <InfoRow label="Creada" value={formatDate(assignment.createdAt)} />
      ) : null}

      {assignment.updatedAt ? (
        <InfoRow label="Actualizada" value={formatDate(assignment.updatedAt)} />
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
