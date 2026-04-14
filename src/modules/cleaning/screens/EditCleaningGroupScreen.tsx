import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
import { useCleaningGroupDetail } from '@/src/modules/cleaning/hooks/use-cleaning-group-detail';
import {
  CleaningGroupForm,
  CleaningGroupFormValues,
  validateCleaningGroupForm,
} from '@/src/modules/cleaning/components/CleaningGroupForm';
import { useCleaningCache } from '@/src/modules/cleaning/context/CleaningCacheContext';
import { updateCleaningGroup } from '@/src/modules/cleaning/services/cleaning-service';
import { CleaningServiceError } from '@/src/modules/cleaning/types/cleaning-group.types';
import { LoadingState } from '@/src/components/common/LoadingState';
import { ErrorState } from '@/src/components/common/ErrorState';

interface EditCleaningGroupScreenProps {
  groupId: string;
}

/** Pantalla para editar nombre, descripción y estado de un grupo de limpieza. */
export function EditCleaningGroupScreen({ groupId }: EditCleaningGroupScreenProps) {
  const colors = useAppColors();
  const router = useRouter();
  const { congregationId, loading: permLoading } = useCleaningPermission();
  const { group, loading, error, refresh } = useCleaningGroupDetail(
    groupId,
    congregationId
  );
  const { refreshAll } = useCleaningCache();

  const [formValues, setFormValues] = useState<CleaningGroupFormValues>({
    name: '',
    description: '',
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CleaningGroupFormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Inicializar form cuando el grupo carga
  useEffect(() => {
    if (group && !initialized) {
      setFormValues({
        name: group.name,
        description: group.description,
        isActive: group.isActive,
      });
      setInitialized(true);
    }
  }, [group, initialized]);

  const handleSubmit = async () => {
    const errors = validateCleaningGroupForm(formValues);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setGlobalError(null);
    setSubmitting(true);

    try {
      await updateCleaningGroup(groupId, {
        name: formValues.name,
        description: formValues.description,
        isActive: formValues.isActive,
      }, congregationId);
      if (group?.congregationId) {
        await refreshAll(group.congregationId).catch(() => undefined);
      }
      router.replace(`/(protected)/cleaning/${groupId}`);
    } catch (err) {
      if (err instanceof CleaningServiceError) {
        setGlobalError(err.message);
      } else {
        setGlobalError('Error al guardar los cambios. Intenta de nuevo.');
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
    backBtn: { padding: 4 },
    headerTitle: {
      flex: 1,
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    scroll: { flex: 1 },
    keyboardContainer: { flex: 1 },
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
    saveBtn: {
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
    saveBtnDisabled: { opacity: 0.6 },
    saveText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#fff',
    },
  });

  if (permLoading || loading) return <LoadingState message="Cargando grupo..." />;
  if (error || !group) return <ErrorState message={error ?? 'Grupo no encontrado.'} onRetry={refresh} />;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar grupo</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>Información del grupo</Text>
          <CleaningGroupForm
            values={formValues}
            onChange={setFormValues}
            errors={formErrors}
            disabled={submitting}
          />

          {globalError && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
              <Text style={styles.errorText}>{globalError}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.saveBtn, submitting && styles.saveBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel="Guardar cambios"
      >
        {submitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.saveText}>Guardar cambios</Text>
        )}
      </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
