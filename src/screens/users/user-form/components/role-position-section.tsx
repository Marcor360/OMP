import { TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import { useAppColors } from '@/src/styles';
import type { UserFormActions, UserFormState } from '@/src/screens/users/user-form/user-form.types';
import { Field } from '@/src/screens/users/user-form/components/form-controls';
import { createUserFormStyles } from '@/src/screens/users/user-form/components/user-form.styles';
import type { UserGender, UserRole } from '@/src/types/user';
import { ROLE_LABELS } from '@/src/types/user';

const GENDER_LABELS: Record<UserGender, string> = {
  masculino: 'Masculino',
  femenino: 'Femenino',
};

const genderOptions: UserGender[] = ['masculino', 'femenino'];
const roles: UserRole[] = ['admin', 'supervisor', 'user'];

export function RolePositionSection({
  state,
  actions,
}: {
  state: UserFormState;
  actions: UserFormActions;
}) {
  const colors = useAppColors();
  const styles = createUserFormStyles(colors);

  return (
    <>
      <Field label="Rol">
        <View style={styles.roleRow}>
          {roles.map((item) => {
            const disabledByRequiredAssignment = state.requiresAdminElder && item !== 'admin';
            const disabled = !state.isAdmin || disabledByRequiredAssignment;

            return (
              <TouchableOpacity
                key={item}
                style={[
                  styles.roleChip,
                  state.role === item && styles.roleChipActive,
                  disabledByRequiredAssignment && styles.departmentChipDisabled,
                ]}
                onPress={() => {
                  if (disabled) return;
                  actions.setRole(item);
                }}
                activeOpacity={0.8}
                disabled={disabled}
              >
                <ThemedText
                  style={[
                    styles.roleChipText,
                    state.role === item && styles.roleChipTextActive,
                    disabledByRequiredAssignment && styles.departmentChipTextDisabled,
                  ]}
                >
                  {ROLE_LABELS[item]}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>
        {state.requiresAdminElder ? (
          <ThemedText style={styles.hintText}>
            Coordinador y Secretario quedan como Administrador y Anciano.
          </ThemedText>
        ) : null}
      </Field>

      <Field label="Genero *" error={state.errors.gender}>
        <View style={styles.roleRow}>
          {genderOptions.map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.roleChip, state.gender === item && styles.roleChipActive]}
              onPress={() => actions.setGender(item)}
              activeOpacity={0.8}
              disabled={!state.canEdit}
            >
              <ThemedText style={[styles.roleChipText, state.gender === item && styles.roleChipTextActive]}>
                {GENDER_LABELS[item]}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      </Field>

      <Field label="Telefono">
        <TextInput
          style={styles.input}
          value={state.phone}
          onChangeText={actions.setPhone}
          placeholder="10 digitos"
          placeholderTextColor={colors.textDisabled}
          keyboardType="phone-pad"
          editable={state.canEdit}
        />
      </Field>
    </>
  );
}
