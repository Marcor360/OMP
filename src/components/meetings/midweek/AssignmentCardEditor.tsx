import React from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ParticipantSelectorField } from '@/src/components/meetings/midweek/ParticipantSelectorField';
import { ThemedText } from '@/src/components/themed-text';
import { ActiveCongregationUser } from '@/src/services/users/active-users-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { MidweekAssignment, createEmptyParticipant } from '@/src/types/midweek-meeting';

export interface AssignmentCardEditorErrors {
  title?: string;
  durationMinutes?: string;
  participants?: Record<string, string>;
}

interface AssignmentCardEditorProps {
  assignment: MidweekAssignment;
  users: ActiveCongregationUser[];
  disabled?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onChange: (assignment: MidweekAssignment) => void;
  errors?: AssignmentCardEditorErrors;
}

const normalizeParticipants = (
  assignment: MidweekAssignment,
  participants: MidweekAssignment['participants']
): MidweekAssignment['participants'] => {
  if (assignment.sectionId !== 'livingAsChristians') {
    return participants;
  }

  return participants.slice(0, 2);
};

export function AssignmentCardEditor({
  assignment,
  users,
  disabled,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onRemove,
  onChange,
  errors,
}: AssignmentCardEditorProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  const isLivingAsChristians = assignment.sectionId === 'livingAsChristians';
  const visibleParticipants = normalizeParticipants(assignment, assignment.participants);

  const updateField = <K extends keyof MidweekAssignment>(
    key: K,
    value: MidweekAssignment[K]
  ) => {
    onChange({
      ...assignment,
      [key]: value,
      participants: normalizeParticipants(assignment, assignment.participants),
    });
  };

  const updateParticipants = (nextParticipants: MidweekAssignment['participants']) => {
    onChange({
      ...assignment,
      participants: normalizeParticipants(assignment, nextParticipants),
    });
  };

  const durationValue =
    typeof assignment.durationMinutes === 'number' && Number.isFinite(assignment.durationMinutes)
      ? String(assignment.durationMinutes)
      : '';

  const addParticipant = () => {
    if (isLivingAsChristians && visibleParticipants.length >= 2) return;
    updateParticipants([...visibleParticipants, createEmptyParticipant()]);
  };

  const participantLabel = (index: number): string => {
    if (!isLivingAsChristians) {
      return `Participante ${index + 1}`;
    }

    return index === 0 ? 'Participante 1' : 'Participante 2 (opcional)';
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText style={styles.cardTitle}>Parte {assignment.order + 1}</ThemedText>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.iconAction, !canMoveUp && styles.disabled]}
            onPress={onMoveUp}
            disabled={disabled || !canMoveUp}
          >
            <Ionicons name="arrow-up-outline" size={16} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconAction, !canMoveDown && styles.disabled]}
            onPress={onMoveDown}
            disabled={disabled || !canMoveDown}
          >
            <Ionicons name="arrow-down-outline" size={16} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconAction} onPress={onRemove} disabled={disabled}>
            <Ionicons name="trash-outline" size={16} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.contentBlock}>
        <View style={styles.fieldWrap}>
          <ThemedText style={styles.label}>Titulo de la parte *</ThemedText>
          <TextInput
            style={[styles.input, errors?.title && styles.inputError]}
            value={assignment.title}
            onChangeText={(next) => updateField('title', next)}
            placeholder="Ej: Discurso, lectura, video"
            placeholderTextColor={colors.textDisabled}
            editable={!disabled}
          />
          {errors?.title ? <ThemedText style={styles.errorText}>{errors.title}</ThemedText> : null}
        </View>

        <View style={styles.fieldWrap}>
          <ThemedText style={styles.label}>Tema / subtitulo</ThemedText>
          <TextInput
            style={styles.input}
            value={assignment.theme ?? ''}
            onChangeText={(next) => updateField('theme', next)}
            placeholder="Ej: Jer 13:1-11"
            placeholderTextColor={colors.textDisabled}
            editable={!disabled}
          />
        </View>

        <View style={styles.fieldWrap}>
          <ThemedText style={styles.label}>Duracion (min)</ThemedText>
          <TextInput
            style={[styles.input, errors?.durationMinutes && styles.inputError]}
            value={durationValue}
            onChangeText={(next) => {
              if (next.trim().length === 0) {
                updateField('durationMinutes', undefined);
                return;
              }

              const parsed = Number(next);
              if (!Number.isFinite(parsed)) {
                updateField('durationMinutes', undefined);
                return;
              }

              updateField('durationMinutes', parsed);
            }}
            placeholder="5"
            placeholderTextColor={colors.textDisabled}
            keyboardType="number-pad"
            editable={!disabled}
          />
          {errors?.durationMinutes ? (
            <ThemedText style={styles.errorText}>{errors.durationMinutes}</ThemedText>
          ) : null}
        </View>
      </View>

      <View style={styles.participantsBlock}>
        <View style={styles.participantsHeader}>
          <ThemedText style={styles.participantTitle}>Participantes</ThemedText>
          {(!isLivingAsChristians || visibleParticipants.length < 2) ? (
            <TouchableOpacity
              style={styles.addParticipantBtn}
              onPress={addParticipant}
              disabled={disabled}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <ThemedText style={styles.addParticipantText}>
                {isLivingAsChristians && visibleParticipants.length === 1
                  ? 'Agregar participante 2'
                  : 'Agregar'}
              </ThemedText>
            </TouchableOpacity>
          ) : null}
        </View>

        {visibleParticipants.length === 0 ? (
          <ThemedText style={styles.emptyText}>Sin participantes todavia.</ThemedText>
        ) : (
          <View style={styles.participantsList}>
            {visibleParticipants.map((participant, participantIndex) => {
              const participantError = errors?.participants?.[participant.id];

              return (
                <ParticipantSelectorField
                  key={participant.id}
                  participant={participant}
                  users={users}
                  disabled={disabled}
                  error={participantError}
                  allowManual
                  title={participantLabel(participantIndex)}
                  canRemove={visibleParticipants.length > 1}
                  onChange={(nextParticipant) => {
                    const nextParticipants = visibleParticipants.map((current, currentIndex) =>
                      currentIndex === participantIndex ? nextParticipant : current
                    );
                    updateParticipants(nextParticipants);
                  }}
                  onRemove={() => {
                    const nextParticipants = visibleParticipants.filter(
                      (_, currentIndex) => currentIndex !== participantIndex
                    );
                    updateParticipants(nextParticipants);
                  }}
                />
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      gap: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    iconAction: {
      width: 32,
      height: 32,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.backgroundLight,
    },
    disabled: {
      opacity: 0.45,
    },
    contentBlock: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.backgroundLight,
      padding: 10,
      gap: 10,
    },
    participantsBlock: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.backgroundLight,
      padding: 10,
      gap: 10,
    },
    fieldWrap: {
      gap: 6,
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      fontSize: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    inputError: {
      borderColor: colors.error,
    },
    errorText: {
      color: colors.error,
      fontSize: 12,
    },
    participantsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    participantTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    addParticipantBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    addParticipantText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    participantsList: {
      gap: 10,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 12,
    },
  });
