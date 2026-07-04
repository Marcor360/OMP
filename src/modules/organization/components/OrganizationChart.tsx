import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useToast } from '@/src/context/toast-context';
import { useUser } from '@/src/context/user-context';
import { DepartmentEditorModal } from '@/src/modules/organization/components/DepartmentEditorModal';
import { OrganizationTreeDesktop } from '@/src/modules/organization/components/OrganizationTreeDesktop';
import { OrganizationTreeMobile } from '@/src/modules/organization/components/OrganizationTreeMobile';
import { useOrganizationChart } from '@/src/modules/organization/hooks/useOrganizationChart';
import { useResponsiveOrganizationLayout } from '@/src/modules/organization/hooks/useResponsiveOrganizationLayout';
import {
  createDepartment,
  regenerateOrgChart,
  seedDefaultDepartments,
  updateDepartment,
} from '@/src/modules/organization/services/organizationService';
import { type Department } from '@/src/modules/organization/types/organization.types';
import {
  canManageOrganizationChart,
  canViewOrganizationChart,
} from '@/src/modules/organization/utils/organizationPermissions';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { formatFirestoreError, isPermissionDeniedError } from '@/src/utils/errors/errors';

const noop = (): void => undefined;

export function OrganizationChart() {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { showToast } = useToast();
  const { appUser, congregationId, loadingProfile } = useUser();
  const layout = useResponsiveOrganizationLayout();
  const canView = canViewOrganizationChart(appUser);
  const canManage = canManageOrganizationChart(appUser);
  const orgChart = useOrganizationChart(canView ? congregationId : null);
  const [saving, setSaving] = useState(false);
  const [departmentModalOpen, setDepartmentModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);

  const handleRegenerate = useCallback(async () => {
    if (!canManage) {
      Alert.alert('Error', 'Solo el coordinador o el secretario pueden generar el organigrama.');
      return;
    }

    try {
      setSaving(true);
      const result = await regenerateOrgChart();
      await orgChart.refresh();
      showToast(result.warnings.length > 0 ? result.warnings[0] : 'Organigrama generado con exito');
    } catch (requestError) {
      Alert.alert(
        'Error',
        isPermissionDeniedError(requestError)
          ? 'Solo el coordinador o el secretario pueden generar el organigrama.'
          : formatFirestoreError(requestError)
      );
    } finally {
      setSaving(false);
    }
  }, [canManage, orgChart, showToast]);

  const saveDepartment = async (
    department: Omit<Department, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => {
    try {
      setSaving(true);
      if (department.id) {
        await updateDepartment(department.congregationId, department.id, department);
        showToast('Departamento actualizado con exito');
      } else {
        await createDepartment(department);
        showToast('Departamento creado con exito');
      }
      setDepartmentModalOpen(false);
      setEditingDepartment(null);
      await orgChart.refresh();
    } catch (requestError) {
      Alert.alert(
        'Error',
        isPermissionDeniedError(requestError)
          ? 'No tienes permisos para modificar el organigrama.'
          : formatFirestoreError(requestError)
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSeedDefaultDepartments = async () => {
    if (!congregationId) {
      Alert.alert('Error', 'No se pudo identificar la congregacion del usuario.');
      return;
    }
    if (!canManage) {
      Alert.alert('Error', 'No tienes permisos para crear departamentos del organigrama.');
      return;
    }

    try {
      setSaving(true);
      await seedDefaultDepartments(congregationId);
      showToast('Departamentos base creados con exito');
      await orgChart.refresh();
    } catch (requestError) {
      Alert.alert(
        'Error',
        isPermissionDeniedError(requestError)
          ? 'No tienes permisos para crear departamentos del organigrama.'
          : 'No se pudieron crear los departamentos base.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loadingProfile || orgChart.loading) {
    return <LoadingState message="Cargando organigrama..." />;
  }

  if (!canView) {
    return <ErrorState message="No tienes acceso al organigrama congregacional." />;
  }

  if (orgChart.error) {
    return <ErrorState message={orgChart.error} onRetry={orgChart.refresh} />;
  }

  const hasDepartments = orgChart.departments.some((department) => department.isActive);
  const hasAssignments = orgChart.assignments.some((assignment) => assignment.isActive);

  return (
    <ScreenContainer scrollable={layout.isMobile} padded={false}>
      <PageHeader
        title="Organigrama Congregacional"
        showBack
        actions={
          canManage ? (
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => {
                  setEditingDepartment(null);
                  setDepartmentModalOpen(true);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="business-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryHeaderButton, saving && styles.disabledButton]}
                onPress={handleRegenerate}
                disabled={saving}
                activeOpacity={0.8}
              >
                <Ionicons name="sync-outline" size={18} color={colors.onPrimary} />
                <ThemedText style={styles.primaryHeaderButtonText}>
                  {saving ? 'Generando...' : 'Generar organigrama'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      <View style={styles.content}>
        {orgChart.tree.warnings.map((warning) => (
          <View key={warning} style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={16} color={colors.warning} />
            <ThemedText style={styles.warningText}>{warning}</ThemedText>
          </View>
        ))}

        {!hasDepartments ? (
          <View style={styles.emptyState}>
            <Ionicons name="git-network-outline" size={34} color={colors.textMuted} />
            <ThemedText style={styles.emptyTitle}>
              Aun no hay organigrama configurado para esta congregacion.
            </ThemedText>
            {canManage ? (
              <View style={styles.emptyActions}>
                <TouchableOpacity
                  style={[styles.emptyButton, saving && styles.disabledButton]}
                  onPress={handleRegenerate}
                  disabled={saving}
                >
                  <ThemedText style={styles.emptyButtonText}>Generar organigrama</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondaryButton, saving && styles.disabledButton]}
                  onPress={handleSeedDefaultDepartments}
                  disabled={saving}
                >
                  <ThemedText style={styles.secondaryButtonText}>Crear departamentos base</ThemedText>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : !hasAssignments ? (
          <View style={styles.emptyState}>
            <Ionicons name="git-network-outline" size={34} color={colors.textMuted} />
            <ThemedText style={styles.emptyTitle}>
              Aun no hay asignaciones. Asigna puestos de servicio a los usuarios y genera el organigrama.
            </ThemedText>
            {canManage ? (
              <TouchableOpacity
                style={[styles.emptyButton, saving && styles.disabledButton]}
                onPress={handleRegenerate}
                disabled={saving}
              >
                <ThemedText style={styles.emptyButtonText}>Generar organigrama</ThemedText>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : layout.isMobile ? (
          <OrganizationTreeMobile roots={orgChart.tree.roots} canEdit={false} onEdit={noop} />
        ) : (
          <OrganizationTreeDesktop
            roots={orgChart.tree.roots}
            canEdit={false}
            compact={layout.mode === 'tablet'}
            onEdit={noop}
          />
        )}
      </View>

      <DepartmentEditorModal
        visible={departmentModalOpen}
        congregationId={congregationId ?? ''}
        department={editingDepartment}
        saving={saving}
        onClose={() => setDepartmentModalOpen(false)}
        onSave={saveDepartment}
      />
    </ScreenContainer>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    content: { flex: 1, padding: 16, gap: 12 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryHeaderButton: {
      minHeight: 40,
      borderRadius: 12,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
    },
    primaryHeaderButtonText: { color: colors.onPrimary, fontSize: 13, fontWeight: '900' },
    warningBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.warning + '55',
      backgroundColor: colors.warning + '18',
      borderRadius: 10,
      padding: 12,
    },
    warningText: { flex: 1, color: colors.warning, fontSize: 13, fontWeight: '700' },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      minHeight: 260,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      padding: 24,
    },
    emptyTitle: { color: colors.textSecondary, textAlign: 'center', fontSize: 14, fontWeight: '700' },
    emptyActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
    emptyButton: { borderRadius: 10, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 10 },
    emptyButtonText: { color: colors.onPrimary, fontWeight: '900' },
    secondaryButton: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    secondaryButtonText: { color: colors.textPrimary, fontWeight: '800' },
    disabledButton: { opacity: 0.65 },
  });
