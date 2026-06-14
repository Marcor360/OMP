import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useToast } from '@/src/context/toast-context';
import { useUser } from '@/src/context/user-context';
import { AssignmentPickerModal } from '@/src/modules/organization/components/AssignmentPickerModal';
import { DepartmentEditorModal } from '@/src/modules/organization/components/DepartmentEditorModal';
import { OrganizationTreeDesktop } from '@/src/modules/organization/components/OrganizationTreeDesktop';
import { OrganizationTreeMobile } from '@/src/modules/organization/components/OrganizationTreeMobile';
import { useOrganizationChart } from '@/src/modules/organization/hooks/useOrganizationChart';
import { useResponsiveOrganizationLayout } from '@/src/modules/organization/hooks/useResponsiveOrganizationLayout';
import {
  createDepartment,
  createDepartmentAssignment,
  deactivateDepartmentAssignment,
  getActiveOrganizationUsers,
  seedDefaultDepartments,
  updateDepartment,
  updateDepartmentAssignment,
} from '@/src/modules/organization/services/organizationService';
import {
  type Department,
  type DepartmentAssignment,
  type OrganizationTreeNode,
} from '@/src/modules/organization/types/organization.types';
import {
  canManageOrganizationChart,
  canViewOrganizationChart,
} from '@/src/modules/organization/utils/organizationPermissions';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import type { AppUser } from '@/src/types/user';
import { formatFirestoreError, isPermissionDeniedError } from '@/src/utils/errors/errors';

export function OrganizationChart() {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { showToast } = useToast();
  const { appUser, congregationId, loadingProfile } = useUser();
  const layout = useResponsiveOrganizationLayout();
  const canView = canViewOrganizationChart(appUser);
  const canManage = canManageOrganizationChart(appUser);
  const orgChart = useOrganizationChart(canView ? congregationId : null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [departmentModalOpen, setDepartmentModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<DepartmentAssignment | null>(null);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);

  const loadUsers = useCallback(async () => {
    if (!congregationId || !canManage) {
      setUsers([]);
      setUsersLoading(false);
      return;
    }

    try {
      setUsersLoading(true);
      setUsersError(null);
      setUsers(await getActiveOrganizationUsers(congregationId));
    } catch (requestError) {
      setUsers([]);
      setUsersError(
        isPermissionDeniedError(requestError)
          ? 'No se pudo leer la lista de usuarios para editar el organigrama. Verifica permisos de usuarios y organigrama.'
          : formatFirestoreError(requestError)
      );
    } finally {
      setUsersLoading(false);
    }
  }, [canManage, congregationId]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const refreshAll = useCallback(async () => {
    await Promise.all([orgChart.refresh(), loadUsers()]);
  }, [loadUsers, orgChart]);

  const openAssignmentModal = (node?: OrganizationTreeNode) => {
    if (node?.assignmentId) {
      setEditingAssignment(orgChart.assignments.find((item) => item.id === node.assignmentId) ?? null);
    } else {
      setEditingAssignment(null);
    }
    setAssignmentModalOpen(true);
  };

  const saveAssignment = async (
    assignment: Omit<DepartmentAssignment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => {
    try {
      setSaving(true);
      if (assignment.id) {
        await updateDepartmentAssignment(assignment.congregationId, assignment.id, assignment);
        showToast('Asignacion actualizada con exito');
      } else {
        await createDepartmentAssignment(assignment);
        showToast('Asignacion creada con exito');
      }
      setAssignmentModalOpen(false);
      setEditingAssignment(null);
      await refreshAll();
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

  const deactivateAssignment = async (assignment: DepartmentAssignment) => {
    try {
      setSaving(true);
      await deactivateDepartmentAssignment(assignment.congregationId, assignment.id);
      showToast('Asignacion desactivada con exito');
      setAssignmentModalOpen(false);
      setEditingAssignment(null);
      await refreshAll();
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

  if (loadingProfile || orgChart.loading || usersLoading) {
    return <LoadingState message="Cargando organigrama..." />;
  }

  if (!canView) {
    return <ErrorState message="No tienes acceso al organigrama congregacional." />;
  }

  if (orgChart.error) {
    return <ErrorState message={orgChart.error} onRetry={refreshAll} />;
  }

  if (canManage && usersError) {
    return <ErrorState message={usersError} onRetry={refreshAll} />;
  }

  const hasDepartments = orgChart.departments.some((department) => department.isActive);
  const hasAssignments = orgChart.assignments.some((assignment) => assignment.isActive);
  const isEmpty = !hasDepartments && !hasAssignments;

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
              {hasDepartments ? (
                <TouchableOpacity
                  style={styles.primaryHeaderButton}
                  onPress={() => openAssignmentModal()}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-outline" size={18} color={colors.onPrimary} />
                  <ThemedText style={styles.primaryHeaderButtonText}>
                    {hasAssignments ? 'Editar organigrama' : 'Crear organigrama'}
                  </ThemedText>
                </TouchableOpacity>
              ) : null}
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

        {isEmpty ? (
          <View style={styles.emptyState}>
            <Ionicons name="git-network-outline" size={34} color={colors.textMuted} />
            <ThemedText style={styles.emptyTitle}>Aun no hay organigrama configurado para esta congregacion.</ThemedText>
            {canManage ? (
              <TouchableOpacity
                style={[styles.emptyButton, saving && styles.disabledButton]}
                onPress={handleSeedDefaultDepartments}
                disabled={saving}
              >
                <ThemedText style={styles.emptyButtonText}>Crear departamentos base</ThemedText>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : !hasAssignments ? (
          <View style={styles.emptyState}>
            <Ionicons name="git-network-outline" size={34} color={colors.textMuted} />
            <ThemedText style={styles.emptyTitle}>Aun no hay asignaciones en el organigrama congregacional.</ThemedText>
            {canManage ? (
              <TouchableOpacity style={styles.emptyButton} onPress={() => openAssignmentModal()}>
                <ThemedText style={styles.emptyButtonText}>Crear organigrama</ThemedText>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : layout.isMobile ? (
          <OrganizationTreeMobile
            roots={orgChart.tree.roots}
            canEdit={canManage}
            onEdit={openAssignmentModal}
          />
        ) : (
          <OrganizationTreeDesktop
            roots={orgChart.tree.roots}
            canEdit={canManage}
            compact={layout.mode === 'tablet'}
            onEdit={openAssignmentModal}
          />
        )}
      </View>

      <AssignmentPickerModal
        visible={assignmentModalOpen}
        departments={orgChart.departments}
        assignments={orgChart.assignments}
        users={users}
        editingAssignment={editingAssignment}
        saving={saving}
        onClose={() => setAssignmentModalOpen(false)}
        onSave={saveAssignment}
        onDeactivate={deactivateAssignment}
      />

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
    content: {
      flex: 1,
      padding: 16,
      gap: 12,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
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
    primaryHeaderButtonText: {
      color: colors.onPrimary,
      fontSize: 13,
      fontWeight: '900',
    },
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
    warningText: {
      flex: 1,
      color: colors.warning,
      fontSize: 13,
      fontWeight: '700',
    },
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
    emptyTitle: {
      color: colors.textSecondary,
      textAlign: 'center',
      fontSize: 14,
      fontWeight: '700',
    },
    emptyButton: {
      borderRadius: 10,
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    emptyButtonText: {
      color: colors.onPrimary,
      fontWeight: '900',
    },
    disabledButton: {
      opacity: 0.65,
    },
  });
