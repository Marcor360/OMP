import React, { useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAppColors } from '@/src/styles';
import { useCleaningPermission } from '@/src/modules/cleaning/hooks/use-cleaning-permission';
import { CleaningGroupForm, CleaningGroupFormValues, validateCleaningGroupForm } from '@/src/modules/cleaning/components/CleaningGroupForm';
import { AddMembersToCleaningGroupModal } from '@/src/modules/cleaning/screens/AddMembersToCleaningGroupModal';
import { createCleaningGroup } from '@/src/modules/cleaning/services/cleaning-service';
import { CleaningServiceError } from '@/src/modules/cleaning/types/cleaning-group.types';
import { LoadingState } from '@/src/components/common/LoadingState';

const DEFAULT_FORM: CleaningGroupFormValues = {
  name: '',
  description: '',
  isActive: true,
};

/** Pantalla para crear un nuevo grupo de limpieza. */
export function CreateCleaningGroupScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const { congregationId, uid, loading: permLoading } = useCleaningPermission();

  const [formValues, setFormValues] = useState<CleaningGroupFormValues>(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CleaningGroupFormValues, string>>>({});
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const handleMembersConfirm = (ids: string[]) => {
    setSelectedMemberIds(ids);
    setShowMemberModal(false);
  };

  const handleSubmit = async () => {
    const errors = validateCleaningGroupForm(formValues);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    if (selectedMemberIds.length < 2) {
      setGlobalError('Un grupo de limpieza debe crearse con al menos 2 integrantes.');
      return;
    }

    setFormErrors({});
    setGlobalError(null);
    setSubmitting(true);

    try {
      const groupId = await createCleaningGroup(
        congregationId,
        {
          name: formValues.name,
          description: formValues.description,
          isActive: formValues.isActive,
        },
        uid,
        selectedMemberIds
      );

      router.replace(`/(protected)/cleaning/${groupId}`);
    } catch (err) {
      if (err instanceof CleaningServiceError) {
        setGlobalError(err.message);
      } else {
        setGlobalError('Ocurrió un error al crear el grupo. Intenta de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundDark,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
      gap: 12,
    },
    backBtn: {
      padding: 4,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    scroll: {
      flex: 1,
    },
    formContainer: {
      padding: 20,
      gap: 24,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 2,
    },
    membersBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    membersBtnLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    membersBtnText: {
      fontSize: 15,
      color: colors.textPrimary,
      fontWeight: '500',
    },
    membersBtnCount: {
      fontSize: 13,
      color: colors.textMuted,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.errorLight,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: `${colors.error}30`,
    },
    errorText: {
      flex: 1,
      fontSize: 13,
      color: colors.error,
      lineHeight: 18,
    },
    submitBtn: {
      margin: 20,
      borderRadius: 14,
      backgroundColor: colors.primary,
      paddingVertical: 16,
      alignItems: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    submitBtnDisabled: {
      opacity: 0.6,
    },
    submitText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#fff',
    },
  });

  if (permLoading) return <LoadingState message="Verificando permisos..." />;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nuevo grupo de limpieza</Text>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.formContainer}>
          {/* Información del grupo */}
          <View>
            <Text style={styles.sectionTitle}>Información del grupo</Text>
          </View>
          <CleaningGroupForm
            values={formValues}
            onChange={setFormValues}
            errors={formErrors}
            disabled={submitting}
          />

          {/* Integrantes iniciales */}
          <View>
            <Text style={styles.sectionTitle}>Integrantes iniciales (opcional)</Text>
          </View>
          <TouchableOpacity
            style={styles.membersBtn}
            onPress={() => setShowMemberModal(true)}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Seleccionar integrantes iniciales"
          >
            <View style={styles.membersBtnLeft}>
              <Ionicons name="people-outline" size={20} color={colors.primary} />
              <View>
                <Text style={styles.membersBtnText}>Seleccionar integrantes</Text>
                <Text style={styles.membersBtnCount}>
                  {selectedMemberIds.length === 0
                    ? 'Ninguno seleccionado'
                    : `${selectedMemberIds.length} seleccionado${selectedMemberIds.length !== 1 ? 's' : ''}`}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Error global */}
          {globalError && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
              <Text style={styles.errorText}>{globalError}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Botón crear */}
      <TouchableOpacity
        style={[styles.submitBtn, (submitting || selectedMemberIds.length < 2) && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting || selectedMemberIds.length < 2}
        accessibilityRole="button"
        accessibilityLabel="Crear grupo de limpieza"
      >
        {submitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.submitText}>Crear grupo</Text>
        )}
      </TouchableOpacity>

      {/* Modal de integrantes */}
      <AddMembersToCleaningGroupModal
        visible={showMemberModal}
        congregationId={congregationId}
        currentGroupId={null}
        preSelectedIds={selectedMemberIds}
        onConfirm={handleMembersConfirm}
        onClose={() => setShowMemberModal(false)}
      />
    </SafeAreaView>
  );
}
