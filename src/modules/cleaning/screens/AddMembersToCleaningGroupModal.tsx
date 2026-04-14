import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppColors } from '@/src/styles';
import { useCleaningAssignableUsers } from '@/src/modules/cleaning/hooks/use-cleaning-assignable-users';
import { CleaningAssignableUser } from '@/src/modules/cleaning/types/cleaning-group.types';
import { CleaningUserSelectItem } from '@/src/modules/cleaning/components/CleaningUserSelectItem';

interface AddMembersToCleaningGroupModalProps {
  visible: boolean;
  congregationId: string;
  /** Grupo al que se agregarán los integrantes. Null cuando es creación nueva. */
  currentGroupId: string | null;
  /** UIDs pre-seleccionados (ej. al editar o crear con integrantes). */
  preSelectedIds?: string[];
  onConfirm: (selectedIds: string[]) => void;
  onClose: () => void;
  /** Muestra spinner en el botón de confirmar mientras se procesa. */
  confirming?: boolean;
}

/**
 * Modal de selección de integrantes para un grupo de limpieza.
 * Lista a todos los usuarios activos de la congregación con su estado de asignabilidad.
 * Permite seleccionar solo a los disponibles.
 */
export function AddMembersToCleaningGroupModal({
  visible,
  congregationId,
  currentGroupId,
  preSelectedIds = [],
  onConfirm,
  onClose,
  confirming = false,
}: AddMembersToCleaningGroupModalProps) {
  const colors = useAppColors();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>(preSelectedIds);

  const { users, loading, error, refresh } = useCleaningAssignableUsers(
    congregationId,
    currentGroupId
  );

  useEffect(() => {
    if (visible) {
      setSelectedIds(preSelectedIds);
      return;
    }

    setSearch('');
  }, [preSelectedIds, visible]);

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }, [users, search]);

  const toggleUser = useCallback((uid: string) => {
    setSelectedIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  }, []);

  const handleConfirm = () => {
    onConfirm(selectedIds);
  };

  const newSelections = selectedIds.filter((id) => !preSelectedIds.includes(id));
  const isCreateMode = currentGroupId === null;
  const hasSelectionChangedInCreateMode =
    selectedIds.length !== preSelectedIds.length ||
    selectedIds.some((id) => !preSelectedIds.includes(id));
  const canConfirm = isCreateMode ? hasSelectionChangedInCreateMode : newSelections.length > 0;

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    keyboardWrap: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '92%',
      overflow: 'hidden',
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 4,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    closeBtn: {
      padding: 4,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      margin: 16,
      backgroundColor: colors.surfaceRaised,
      borderRadius: 12,
      paddingHorizontal: 12,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.textPrimary,
      paddingVertical: 10,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      gap: 8,
    },
    centerText: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
    },
    retryBtn: {
      marginTop: 4,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: `${colors.primary}20`,
      borderRadius: 8,
    },
    retryText: {
      color: colors.primary,
      fontWeight: '600',
      fontSize: 13,
    },
    emptyText: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      paddingVertical: 24,
      paddingHorizontal: 16,
    },
    footer: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      flexDirection: 'row',
      gap: 12,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    confirmBtn: {
      flex: 2,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: colors.primary,
    },
    confirmBtnDisabled: {
      opacity: 0.6,
    },
    confirmText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#fff',
    },
  });

  const renderItem = ({ item }: { item: CleaningAssignableUser }) => (
    <CleaningUserSelectItem
      user={item}
      selected={selectedIds.includes(item.uid)}
      onToggle={toggleUser}
    />
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.keyboardWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Agregar integrantes</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cerrar modal"
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Buscador */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar usuario..."
              placeholderTextColor={colors.textDisabled}
              returnKeyType="search"
              clearButtonMode="while-editing"
              accessibilityLabel="Buscar usuario"
            />
          </View>

          {/* Contenido */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={styles.centerText}>Cargando usuarios...</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={32} color={colors.error} />
              <Text style={styles.centerText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={refresh}>
                <Text style={styles.retryText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.uid}
              renderItem={renderItem}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {search.length > 0
                    ? 'No se encontraron usuarios con ese nombre.'
                    : 'No hay usuarios disponibles en la congregación.'}
                </Text>
              }
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            />
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={confirming}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                (!canConfirm || confirming) && styles.confirmBtnDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!canConfirm || confirming}
              accessibilityRole="button"
              accessibilityLabel={
                isCreateMode
                  ? 'Guardar seleccion de integrantes'
                  : `Agregar ${newSelections.length} usuario${newSelections.length !== 1 ? 's' : ''}`
              }
            >
              {confirming ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.confirmText}>
                  {isCreateMode
                    ? 'Guardar seleccion'
                    : newSelections.length === 0
                      ? 'Seleccionar usuarios'
                      : `Agregar ${newSelections.length} usuario${newSelections.length !== 1 ? 's' : ''}`}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
