import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import type { Department } from '@/src/modules/organization/types/organization.types';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

type DepartmentEditorModalProps = {
  visible: boolean;
  congregationId: string;
  department?: Department | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (department: Omit<Department, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
};

export function DepartmentEditorModal({
  visible,
  congregationId,
  department,
  saving = false,
  onClose,
  onSave,
}: DepartmentEditorModalProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [order, setOrder] = useState('1');
  const [isActive, setIsActive] = useState(true);
  const [allowMultipleManagers, setAllowMultipleManagers] = useState(false);
  const [allowMultipleAssistants, setAllowMultipleAssistants] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setName(department?.name ?? '');
    setDescription(department?.description ?? '');
    setOrder(String(department?.order ?? 1));
    setIsActive(department?.isActive ?? true);
    setAllowMultipleManagers(department?.allowMultipleManagers ?? false);
    setAllowMultipleAssistants(department?.allowMultipleAssistants ?? true);
  }, [department, visible]);

  const save = () => {
    if (!name.trim()) return;
    onSave({
      id: department?.id,
      congregationId,
      name: name.trim(),
      description: description.trim(),
      order: Number(order) || 1,
      isActive,
      allowMultipleManagers,
      allowMultipleAssistants,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>
              {department ? 'Editar departamento' : 'Nuevo departamento'}
            </ThemedText>
            <TouchableOpacity style={styles.iconButton} onPress={onClose}>
              <Ionicons name="close-outline" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Field label="Nombre">
              <TextInput value={name} onChangeText={setName} style={styles.input} placeholderTextColor={colors.textDisabled} />
            </Field>
            <Field label="Descripcion">
              <TextInput
                value={description}
                onChangeText={setDescription}
                style={[styles.input, styles.textArea]}
                multiline
                placeholderTextColor={colors.textDisabled}
              />
            </Field>
            <Field label="Orden">
              <TextInput value={order} onChangeText={setOrder} keyboardType="numeric" style={styles.input} />
            </Field>

            <ToggleRow label="Activo" value={isActive} onValueChange={setIsActive} />
            <ToggleRow label="Permitir varios encargados" value={allowMultipleManagers} onValueChange={setAllowMultipleManagers} />
            <ToggleRow label="Permitir varios auxiliares" value={allowMultipleAssistants} onValueChange={setAllowMultipleAssistants} />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose} disabled={saving}>
              <ThemedText style={styles.cancelText}>Cancelar</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={save} disabled={saving}>
              <ThemedText style={styles.saveText}>{saving ? 'Guardando...' : 'Guardar'}</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useAppColors();
  return (
    <View style={{ gap: 6 }}>
      <ThemedText style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '800' }}>{label}</ThemedText>
      {children}
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const colors = useAppColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <ThemedText style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>{label}</ThemedText>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    },
    modal: {
      width: '100%',
      maxWidth: 560,
      borderRadius: 12,
      backgroundColor: colors.backgroundDark,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '900',
    },
    iconButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    content: {
      gap: 14,
      padding: 16,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
    },
    textArea: {
      minHeight: 78,
      textAlignVertical: 'top',
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    button: {
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    cancelButton: {
      backgroundColor: colors.surface,
    },
    saveButton: {
      backgroundColor: colors.primary,
    },
    cancelText: {
      color: colors.textPrimary,
      fontWeight: '800',
    },
    saveText: {
      color: colors.onPrimary,
      fontWeight: '900',
    },
  });
