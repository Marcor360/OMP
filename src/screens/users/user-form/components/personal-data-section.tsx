import { Ionicons } from '@expo/vector-icons';
import { TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import { useAppColors } from '@/src/styles';
import type { UserFormActions, UserFormState } from '@/src/screens/users/user-form/user-form.types';
import { Field, PasswordInput } from '@/src/screens/users/user-form/components/form-controls';
import { createUserFormStyles } from '@/src/screens/users/user-form/components/user-form.styles';

export function PersonalDataSection({
  mode,
  state,
  actions,
}: {
  mode: 'create' | 'edit';
  state: UserFormState;
  actions: UserFormActions;
}) {
  const colors = useAppColors();
  const styles = createUserFormStyles(colors);
  const { errors, canEdit } = state;

  if (mode === 'create') {
    return (
      <>
        <Field label="Primer nombre *" error={errors.firstName}>
          <TextInput
            style={[styles.input, errors.firstName && styles.inputError]}
            value={state.firstName}
            onChangeText={actions.setFirstName}
            placeholder="Ej: Juan"
            placeholderTextColor={colors.textDisabled}
            editable={canEdit}
          />
        </Field>

        <Field label="Segundo nombre">
          <TextInput
            style={styles.input}
            value={state.middleName}
            onChangeText={actions.setMiddleName}
            placeholder="Ej: Carlos"
            placeholderTextColor={colors.textDisabled}
            editable={canEdit}
          />
        </Field>

        <Field label="Apellido paterno *" error={errors.lastName}>
          <TextInput
            style={[styles.input, errors.lastName && styles.inputError]}
            value={state.lastName}
            onChangeText={actions.setLastName}
            placeholder="Ej: Perez"
            placeholderTextColor={colors.textDisabled}
            editable={canEdit}
          />
        </Field>

        <Field label="Apellido materno">
          <TextInput
            style={styles.input}
            value={state.secondLastName}
            onChangeText={actions.setSecondLastName}
            placeholder="Ej: Silva"
            placeholderTextColor={colors.textDisabled}
            editable={canEdit}
          />
        </Field>

        <Field label="Contrasena inicial *" error={errors.password}>
          <PasswordInput
            value={state.password}
            onChangeText={actions.setPassword}
            placeholder="Minimo 6 caracteres"
            visible={state.showPassword}
            onToggleVisibility={actions.togglePasswordVisibility}
            onCopy={() => void actions.handleCopyValue('Contrasena', state.password)}
            hasError={Boolean(errors.password)}
            editable={canEdit}
          />
        </Field>

        <Field label="Correo generado automaticamente">
          <View style={styles.copyInputWrap}>
            <TextInput
              style={styles.copyInput}
              value={state.generatedEmailPreview}
              editable={false}
            />
            <TouchableOpacity
              style={styles.copyButton}
              onPress={() => void actions.handleCopyValue('Correo', state.generatedEmailPreview)}
              activeOpacity={0.8}
              disabled={!state.generatedEmailPreview.trim()}
            >
              <Ionicons name="copy-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ThemedText style={styles.hintText}>
            Si ya existe un correo igual, se intentara con primer+segundo+apellido y despues numeracion.
          </ThemedText>
        </Field>
      </>
    );
  }

  return (
    <>
      <Field label="Nombre completo *" error={errors.displayName}>
        <TextInput
          style={[styles.input, errors.displayName && styles.inputError]}
          value={state.displayName}
          onChangeText={actions.setDisplayName}
          placeholder="Ej: Juan Perez"
          placeholderTextColor={colors.textDisabled}
          editable={canEdit}
        />
      </Field>

      <Field label="Nueva contrasena (opcional)" error={errors.newPassword}>
        <PasswordInput
          value={state.newPassword}
          onChangeText={actions.setNewPassword}
          placeholder="Dejar vacio para no cambiar"
          visible={state.showNewPassword}
          onToggleVisibility={actions.toggleNewPasswordVisibility}
          onCopy={() => void actions.handleCopyValue('Nueva contrasena', state.newPassword)}
          hasError={Boolean(errors.newPassword)}
          editable={state.isAdmin}
        />
      </Field>
    </>
  );
}
