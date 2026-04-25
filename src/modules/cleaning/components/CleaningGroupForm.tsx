import React from 'react';
import {
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAppColors } from '@/src/styles';
import { CleaningGroupType } from '@/src/modules/cleaning/types/cleaning-group.types';

export interface CleaningGroupFormValues {
  name: string;
  description: string;
  groupType: CleaningGroupType;
  isActive: boolean;
}

interface CleaningGroupFormProps {
  values: CleaningGroupFormValues;
  onChange: (values: CleaningGroupFormValues) => void;
  errors?: Partial<Record<keyof CleaningGroupFormValues, string>>;
  disabled?: boolean;
}

/**
 * Formulario reutilizable para crear y editar grupos de limpieza.
 * Controlado: recibe valores y emite cambios al padre.
 */
export function CleaningGroupForm({
  values,
  onChange,
  errors = {},
  disabled = false,
}: CleaningGroupFormProps) {
  const colors = useAppColors();

  const set = <K extends keyof CleaningGroupFormValues>(
    key: K,
    value: CleaningGroupFormValues[K]
  ) => onChange({ ...values, [key]: value });

  const styles = StyleSheet.create({
    container: {
      gap: 20,
    },
    field: {
      gap: 6,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    input: {
      backgroundColor: colors.surfaceRaised,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputError: {
      borderColor: colors.error,
    },
    textarea: {
      height: 88,
      textAlignVertical: 'top',
    },
    errorText: {
      fontSize: 12,
      color: colors.error,
      marginTop: 2,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceRaised,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    switchLabel: {
      fontSize: 15,
      color: colors.textPrimary,
      fontWeight: '500',
    },
    switchHint: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    typeOptionRow: {
      flexDirection: 'row',
      gap: 10,
    },
    typeOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderWidth: 1,
    },
    typeOptionText: {
      fontSize: 14,
      fontWeight: '700',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.field}>
        <Text style={styles.label}>Tipo de grupo</Text>
        <View style={styles.typeOptionRow}>
          {([
            { value: 'standard' as const, label: 'Normal' },
            { value: 'family' as const, label: 'Familiar' },
          ]).map((option) => {
            const selected = values.groupType === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                onPress={() => {
                  if (!disabled) set('groupType', option.value);
                }}
                disabled={disabled}
                style={[
                  styles.typeOption,
                  {
                    backgroundColor: selected ? `${colors.primary}18` : colors.surfaceRaised,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.typeOptionText,
                    { color: selected ? colors.primary : colors.textSecondary },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Nombre */}
      <View style={styles.field}>
        <Text style={styles.label}>
          {values.groupType === 'family' ? 'Nombre de la familia *' : 'Nombre del grupo *'}
        </Text>
        <TextInput
          style={[styles.input, errors.name ? styles.inputError : undefined]}
          value={values.name}
          onChangeText={(text) => set('name', text)}
          placeholder={values.groupType === 'family' ? 'Ej. Familia Garcia' : 'Ej. Grupo Martes'}
          placeholderTextColor={colors.textDisabled}
          editable={!disabled}
          maxLength={60}
          returnKeyType="next"
          accessibilityLabel="Nombre del grupo de limpieza"
        />
        {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
      </View>

      {/* Descripción */}
      <View style={styles.field}>
        <Text style={styles.label}>Descripción</Text>
        <TextInput
          style={[styles.input, styles.textarea, errors.description ? styles.inputError : undefined]}
          value={values.description}
          onChangeText={(text) => set('description', text)}
          placeholder="Breve descripción del grupo..."
          placeholderTextColor={colors.textDisabled}
          editable={!disabled}
          maxLength={200}
          multiline
          numberOfLines={3}
          returnKeyType="done"
          accessibilityLabel="Descripción del grupo de limpieza"
        />
        {errors.description && (
          <Text style={styles.errorText}>{errors.description}</Text>
        )}
      </View>

      {/* Estado activo */}
      <View style={styles.field}>
        <Text style={styles.label}>Estado</Text>
        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchLabel}>Grupo activo</Text>
            <Text style={styles.switchHint}>
              {values.isActive ? 'Visible y operativo' : 'Desactivado'}
            </Text>
          </View>
          <Switch
            value={values.isActive}
            onValueChange={(v) => set('isActive', v)}
            disabled={disabled}
            trackColor={{ false: colors.border, true: `${colors.primary}60` }}
            thumbColor={values.isActive ? colors.primary : colors.textDisabled}
            accessibilityLabel="Activar o desactivar el grupo"
          />
        </View>
      </View>
    </View>
  );
}

// ─── Validador del formulario ─────────────────────────────────────────────────

export const validateCleaningGroupForm = (
  values: CleaningGroupFormValues
): Partial<Record<keyof CleaningGroupFormValues, string>> => {
  const errors: Partial<Record<keyof CleaningGroupFormValues, string>> = {};
  if (!values.name.trim()) {
    errors.name = 'El nombre del grupo es requerido.';
  } else if (values.name.trim().length < 2) {
    errors.name = 'El nombre debe tener al menos 2 caracteres.';
  }
  return errors;
};
