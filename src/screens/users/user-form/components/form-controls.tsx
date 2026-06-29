import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import { useAppColors } from '@/src/styles';
import {
  createUserFormStyles,
} from '@/src/screens/users/user-form/components/user-form.styles';

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  const colors = useAppColors();
  const styles = createUserFormStyles(colors);

  return (
    <View style={styles.fieldWrap}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      {children}
      {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
    </View>
  );
}

export function ToggleChip({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const colors = useAppColors();
  const styles = createUserFormStyles(colors);

  return (
    <TouchableOpacity
      style={[
        styles.departmentChip,
        selected && styles.departmentChipActive,
        disabled && styles.departmentChipDisabled,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled}
    >
      <ThemedText
        style={[
          styles.departmentChipText,
          selected && styles.departmentChipTextActive,
          disabled && styles.departmentChipTextDisabled,
        ]}
      >
        {label}
      </ThemedText>
    </TouchableOpacity>
  );
}

export function PasswordInput({
  value,
  onChangeText,
  placeholder,
  visible,
  onToggleVisibility,
  onCopy,
  hasError,
  editable,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  visible: boolean;
  onToggleVisibility: () => void;
  onCopy?: () => void;
  hasError: boolean;
  editable: boolean;
}) {
  const colors = useAppColors();
  const styles = createUserFormStyles(colors);

  return (
    <View style={[styles.passwordWrap, hasError && styles.inputError]}>
      <TextInput
        style={styles.passwordInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textDisabled}
        secureTextEntry={!visible}
        autoCapitalize="none"
        editable={editable}
      />
      <TouchableOpacity style={styles.eyeButton} onPress={onToggleVisibility} activeOpacity={0.8}>
        <Ionicons
          name={visible ? 'eye-off-outline' : 'eye-outline'}
          size={18}
          color={colors.textMuted}
        />
      </TouchableOpacity>
      {onCopy ? (
        <TouchableOpacity
          style={styles.eyeButton}
          onPress={onCopy}
          activeOpacity={0.8}
          disabled={!value.trim()}
        >
          <Ionicons name="copy-outline" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
