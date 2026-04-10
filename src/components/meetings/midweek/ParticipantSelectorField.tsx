import React, { useMemo, useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/src/components/themed-text';
import { ActiveCongregationUser } from '@/src/services/users/active-users-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { ParticipantAssignment } from '@/src/types/midweek-meeting';

interface ParticipantSelectorFieldProps {
  participant: ParticipantAssignment;
  users: ActiveCongregationUser[];
  disabled?: boolean;
  onChange: (participant: ParticipantAssignment) => void;
  onRemove: () => void;
  error?: string;
}

export function ParticipantSelectorField({
  participant,
  users,
  disabled,
  onChange,
  onRemove,
  error,
}: ParticipantSelectorFieldProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const [expanded, setExpanded] = useState(false);

  const selectedUser = useMemo(
    () => users.find((user) => user.uid === participant.userId),
    [participant.userId, users]
  );

  const updateMode = (mode: ParticipantAssignment['mode']) => {
    if (mode === participant.mode) return;

    onChange({
      ...participant,
      mode,
      userId: mode === 'user' ? participant.userId : undefined,
      displayName: mode === 'manual' ? participant.displayName : selectedUser?.displayName ?? '',
    });
  };

  const selectUser = (user: ActiveCongregationUser) => {
    onChange({
      ...participant,
      mode: 'user',
      userId: user.uid,
      displayName: user.displayName,
    });
    setExpanded(false);
  };

  const selectedLabel = selectedUser?.displayName ?? participant.displayName;

  return (
    <View style={styles.container}>
      <View style={styles.rowBetween}>
        <ThemedText style={styles.title}>Participante</ThemedText>
        <TouchableOpacity onPress={onRemove} disabled={disabled} style={styles.removeButton}>
          <Ionicons name="trash-outline" size={16} color={colors.error} />
          <ThemedText style={styles.removeText}>Quitar</ThemedText>
        </TouchableOpacity>
      </View>

      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeChip, participant.mode === 'user' && styles.modeChipActive]}
          onPress={() => updateMode('user')}
          activeOpacity={0.8}
          disabled={disabled}
        >
          <ThemedText style={[styles.modeText, participant.mode === 'user' && styles.modeTextActive]}>
            Usuario
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeChip, participant.mode === 'manual' && styles.modeChipActive]}
          onPress={() => updateMode('manual')}
          activeOpacity={0.8}
          disabled={disabled}
        >
          <ThemedText style={[styles.modeText, participant.mode === 'manual' && styles.modeTextActive]}>
            Manual
          </ThemedText>
        </TouchableOpacity>
      </View>

      <View style={styles.fieldWrap}>
        <ThemedText style={styles.label}>Rol</ThemedText>
        <TextInput
          style={styles.input}
          value={participant.roleLabel ?? ''}
          onChangeText={(nextRole) => onChange({ ...participant, roleLabel: nextRole })}
          placeholder="Ej: Estudiante, Ayudante, Oracion"
          placeholderTextColor={colors.textDisabled}
          editable={!disabled}
        />
      </View>

      {participant.mode === 'manual' ? (
        <View style={styles.fieldWrap}>
          <ThemedText style={styles.label}>Nombre manual</ThemedText>
          <TextInput
            style={[styles.input, error && styles.inputError]}
            value={participant.displayName}
            onChangeText={(nextName) => onChange({ ...participant, displayName: nextName })}
            placeholder="Nombre del participante"
            placeholderTextColor={colors.textDisabled}
            editable={!disabled}
          />
        </View>
      ) : (
        <View style={styles.fieldWrap}>
          <ThemedText style={styles.label}>Usuario del sistema</ThemedText>
          <TouchableOpacity
            style={[styles.userSelectButton, error && styles.inputError]}
            onPress={() => setExpanded((current) => !current)}
            activeOpacity={0.8}
            disabled={disabled}
          >
            <ThemedText style={styles.userSelectText} numberOfLines={1}>
              {selectedLabel || 'Seleccionar usuario'}
            </ThemedText>
            <Ionicons
              name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
              size={16}
              color={colors.textMuted}
            />
          </TouchableOpacity>

          {expanded ? (
            <View style={styles.userList}>
              {users.length === 0 ? (
                <ThemedText style={styles.emptyUsers}>No hay usuarios activos.</ThemedText>
              ) : (
                users.map((user) => {
                  const isSelected = participant.userId === user.uid;

                  return (
                    <TouchableOpacity
                      key={user.uid}
                      style={[styles.userOption, isSelected && styles.userOptionSelected]}
                      onPress={() => selectUser(user)}
                      activeOpacity={0.7}
                    >
                      <ThemedText style={[styles.userOptionText, isSelected && styles.userOptionTextSelected]}>
                        {user.displayName}
                      </ThemedText>
                      {user.email ? <ThemedText style={styles.userOptionEmail}>{user.email}</ThemedText> : null}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          ) : null}
        </View>
      )}

      {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    container: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundLight,
      borderRadius: 10,
      padding: 10,
      gap: 10,
    },
    rowBetween: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
    removeButton: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4 },
    removeText: { fontSize: 12, color: colors.error, fontWeight: '600' },
    modeRow: { flexDirection: 'row', gap: 8 },
    modeChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.surface,
    },
    modeChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    modeText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
    modeTextActive: { color: '#fff' },
    fieldWrap: { gap: 6 },
    label: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 10,
      color: colors.textPrimary,
      fontSize: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    inputError: {
      borderColor: colors.error,
    },
    userSelectButton: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    userSelectText: { flex: 1, fontSize: 14, color: colors.textPrimary },
    userList: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      maxHeight: 200,
    },
    userOption: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 2,
    },
    userOptionSelected: {
      backgroundColor: colors.primary + '22',
    },
    userOptionText: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
    userOptionTextSelected: { color: colors.primary, fontWeight: '700' },
    userOptionEmail: { fontSize: 11, color: colors.textMuted },
    emptyUsers: { paddingHorizontal: 12, paddingVertical: 12, color: colors.textMuted, fontSize: 13 },
    errorText: { color: colors.error, fontSize: 12 },
  });
