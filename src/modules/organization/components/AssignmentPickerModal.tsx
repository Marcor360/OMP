import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import {
  type Department,
  type DepartmentAssignment,
  ORGANIZATION_POSITION_LABELS,
  type OrganizationPosition,
} from '@/src/modules/organization/types/organization.types';
import type { AppUser } from '@/src/types/user';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

type AssignmentPickerModalProps = {
  visible: boolean;
  departments: Department[];
  assignments: DepartmentAssignment[];
  users: AppUser[];
  editingAssignment?: DepartmentAssignment | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (assignment: Omit<DepartmentAssignment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => void;
  onDeactivate?: (assignment: DepartmentAssignment) => void;
};

const POSITIONS: OrganizationPosition[] = ['coordinador', 'secretario', 'encargado', 'auxiliar', 'apoyo'];

const defaultTitle = (
  position: OrganizationPosition,
  departmentName: string
): string => {
  if (position === 'coordinador') return 'Coordinador';
  if (position === 'secretario') return 'Secretario';
  return `${ORGANIZATION_POSITION_LABELS[position]} de ${departmentName}`;
};

export function AssignmentPickerModal({
  visible,
  departments,
  assignments,
  users,
  editingAssignment,
  saving = false,
  onClose,
  onSave,
  onDeactivate,
}: AssignmentPickerModalProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const activeDepartments = useMemo(() => departments.filter((item) => item.isActive), [departments]);
  const activeUsers = useMemo(() => users.filter((item) => item.isActive), [users]);

  const [departmentId, setDepartmentId] = useState('predicacion');
  const [position, setPosition] = useState<OrganizationPosition>('encargado');
  const [userId, setUserId] = useState('');
  const [title, setTitle] = useState('');
  const [parentAssignmentId, setParentAssignmentId] = useState<string | null>(null);
  const [order, setOrder] = useState('1');

  const selectedDepartment = activeDepartments.find((item) => item.id === departmentId);
  const selectedUser = activeUsers.find((item) => item.uid === userId);

  useEffect(() => {
    if (!visible) return;

    if (editingAssignment) {
      setDepartmentId(editingAssignment.departmentId);
      setPosition(editingAssignment.position);
      setUserId(editingAssignment.userId);
      setTitle(editingAssignment.title);
      setParentAssignmentId(editingAssignment.parentAssignmentId ?? null);
      setOrder(String(editingAssignment.order));
      return;
    }

    setDepartmentId(activeDepartments.find((item) => item.id === 'predicacion')?.id ?? activeDepartments[0]?.id ?? '');
    setPosition('encargado');
    setUserId(activeUsers[0]?.uid ?? '');
    setTitle('');
    setParentAssignmentId(null);
    setOrder('1');
  }, [activeDepartments, activeUsers, editingAssignment, visible]);

  useEffect(() => {
    if (position === 'coordinador') setDepartmentId('coordinacion');
    if (position === 'secretario') setDepartmentId('secretaria');
  }, [position]);

  useEffect(() => {
    if (!selectedDepartment) return;
    if (editingAssignment && title.trim()) return;
    setTitle(defaultTitle(position, selectedDepartment.name));
  }, [editingAssignment, position, selectedDepartment, title]);

  const save = () => {
    if (!selectedDepartment || !selectedUser) return;

    onSave({
      id: editingAssignment?.id,
      congregationId: selectedDepartment.congregationId,
      departmentId: selectedDepartment.id,
      departmentName: selectedDepartment.name,
      userId: selectedUser.uid,
      displayName: selectedUser.displayName,
      email: selectedUser.email,
      position,
      title: title.trim() || defaultTitle(position, selectedDepartment.name),
      parentAssignmentId,
      level: position === 'coordinador' ? 0 : position === 'secretario' ? 1 : 3,
      order: Number(order) || 1,
      isActive: true,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>
              {editingAssignment ? 'Editar asignacion' : 'Nueva asignacion'}
            </ThemedText>
            <TouchableOpacity style={styles.iconButton} onPress={onClose}>
              <Ionicons name="close-outline" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <FieldLabel label="Departamento" />
            <View style={styles.chipGrid}>
              {activeDepartments.map((department) => (
                <Chip
                  key={department.id}
                  label={department.name}
                  active={department.id === departmentId}
                  disabled={position === 'coordinador' || position === 'secretario'}
                  onPress={() => setDepartmentId(department.id)}
                />
              ))}
            </View>

            <FieldLabel label="Puesto" />
            <View style={styles.chipGrid}>
              {POSITIONS.map((item) => (
                <Chip
                  key={item}
                  label={ORGANIZATION_POSITION_LABELS[item]}
                  active={item === position}
                  onPress={() => setPosition(item)}
                />
              ))}
            </View>

            <FieldLabel label="Usuario activo" />
            <View style={styles.chipGrid}>
              {activeUsers.map((user) => (
                <Chip
                  key={user.uid}
                  label={user.displayName}
                  active={user.uid === userId}
                  onPress={() => setUserId(user.uid)}
                />
              ))}
            </View>

            <FieldLabel label="Padre jerarquico opcional" />
            <View style={styles.chipGrid}>
              <Chip label="Sin padre" active={!parentAssignmentId} onPress={() => setParentAssignmentId(null)} />
              {assignments
                .filter((assignment) => assignment.isActive && assignment.id !== editingAssignment?.id)
                .map((assignment) => (
                  <Chip
                    key={assignment.id}
                    label={`${assignment.displayName} - ${assignment.title}`}
                    active={assignment.id === parentAssignmentId}
                    onPress={() => setParentAssignmentId(assignment.id)}
                  />
                ))}
            </View>

            <FieldLabel label="Titulo" />
            <TextInput
              value={title}
              onChangeText={setTitle}
              style={styles.input}
              placeholder="Titulo de la asignacion"
              placeholderTextColor={colors.textDisabled}
            />

            <FieldLabel label="Orden" />
            <TextInput
              value={order}
              onChangeText={setOrder}
              style={styles.input}
              keyboardType="numeric"
              placeholder="1"
              placeholderTextColor={colors.textDisabled}
            />
          </ScrollView>

          <View style={styles.actions}>
            {editingAssignment && onDeactivate ? (
              <TouchableOpacity
                style={[styles.button, styles.deleteButton]}
                onPress={() => onDeactivate(editingAssignment)}
                disabled={saving}
              >
                <ThemedText style={styles.deleteText}>Desactivar</ThemedText>
              </TouchableOpacity>
            ) : null}
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

function FieldLabel({ label }: { label: string }) {
  const colors = useAppColors();
  return <ThemedText style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 13 }}>{label}</ThemedText>;
}

function Chip({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        active && styles.chipActive,
        disabled && styles.chipDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <ThemedText style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </ThemedText>
    </TouchableOpacity>
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
      maxWidth: 760,
      maxHeight: '92%',
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
      gap: 12,
      padding: 16,
    },
    chipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      maxWidth: '100%',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipDisabled: {
      opacity: 0.45,
    },
    chipText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    chipTextActive: {
      color: colors.onPrimary,
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
    deleteButton: {
      marginRight: 'auto',
      backgroundColor: colors.error + '18',
    },
    cancelText: {
      color: colors.textPrimary,
      fontWeight: '800',
    },
    saveText: {
      color: colors.onPrimary,
      fontWeight: '900',
    },
    deleteText: {
      color: colors.error,
      fontWeight: '900',
    },
  });
