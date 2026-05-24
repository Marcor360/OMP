import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { EmptyState } from '@/src/components/common/EmptyState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import { useOrgChart } from '@/src/hooks/use-org-chart';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import {
  DEPARTMENT_CATEGORIES,
  DEPARTMENT_CATEGORY_LABELS,
  type Department,
  type DepartmentPayload,
  type OrgChartNode,
} from '@/src/types/org-chart';
import type { AppUser } from '@/src/types/user';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { canManageOrgChart, canViewOrgChart } from '@/src/utils/permissions/permissions';

type DepartmentModalState =
  | { mode: 'create'; department?: undefined }
  | { mode: 'edit'; department: Department }
  | null;

type AssignModalState = {
  department: Department;
  role: 'responsible' | 'assistant';
} | null;

const emptyDepartmentPayload = (): DepartmentPayload => ({
  name: '',
  category: 'other',
  parentId: null,
  order: 0,
});

export function OrgChartScreen() {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { appUser, congregationId, loadingProfile, profileError } = useUser();
  const canView = canViewOrgChart(appUser);
  const canManage = canManageOrgChart(appUser);
  const orgChart = useOrgChart(congregationId, appUser);
  const [departmentModal, setDepartmentModal] = useState<DepartmentModalState>(null);
  const [assignmentModal, setAssignmentModal] = useState<AssignModalState>(null);

  const activeNodeCount = useMemo(
    () => DEPARTMENT_CATEGORIES.reduce((count, category) => count + orgChart.chart[category].length, 0),
    [orgChart.chart]
  );

  const handleInitialize = async () => {
    try {
      await orgChart.initialize();
      Alert.alert('Organigrama', 'Plantilla inicial creada.');
    } catch (error) {
      Alert.alert('Error', formatFirestoreError(error));
    }
  };

  if (loadingProfile || orgChart.loading) {
    return <LoadingState message="Cargando organigrama..." />;
  }

  if (!canView || !appUser || !congregationId) {
    return <ErrorState message={profileError ?? 'No tienes acceso al organigrama.'} />;
  }

  if (orgChart.error) {
    return <ErrorState message={orgChart.error} onRetry={() => void orgChart.refresh()} />;
  }

  return (
    <ScreenContainer refreshing={orgChart.loading} onRefresh={orgChart.refresh}>
      <PageHeader
        title="Organigrama"
        subtitle="Funciones y responsabilidades de la congregacion"
        actions={
          canManage ? (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setDepartmentModal({ mode: 'create' })}
              activeOpacity={0.85}
            >
              <Ionicons name="add-outline" size={18} color={colors.onPrimary} />
              <ThemedText style={styles.headerButtonText}>Nuevo</ThemedText>
            </TouchableOpacity>
          ) : null
        }
      />

      {!canManage ? (
        <View style={styles.readOnlyBanner}>
          <Ionicons name="eye-outline" size={18} color={colors.primary} />
          <ThemedText style={styles.readOnlyText}>Vista de solo lectura</ThemedText>
        </View>
      ) : null}

      {activeNodeCount === 0 ? (
        <EmptyState
          icon="git-network-outline"
          title="El organigrama aun no ha sido configurado"
          description={
            canManage
              ? 'Crea la plantilla inicial para empezar a asignar responsables y auxiliares.'
              : 'Cuando se configuren departamentos activos, apareceran aqui.'
          }
          actionLabel={canManage ? 'Crear plantilla inicial' : undefined}
          onAction={canManage ? handleInitialize : undefined}
        />
      ) : (
        <View style={styles.categoryList}>
          {DEPARTMENT_CATEGORIES.map((category) => {
            const nodes = orgChart.chart[category];
            if (nodes.length === 0) return null;

            return (
              <View key={category} style={styles.categorySection}>
                <View style={styles.categoryHeader}>
                  <ThemedText style={styles.categoryTitle}>
                    {DEPARTMENT_CATEGORY_LABELS[category]}
                  </ThemedText>
                  <ThemedText style={styles.categoryCount}>{nodes.length}</ThemedText>
                </View>
                <View style={styles.nodeGrid}>
                  {nodes.map((node) => (
                    <OrgChartCard
                      key={node.department.id}
                      node={node}
                      users={orgChart.users}
                      canManage={canManage}
                      saving={orgChart.saving}
                      onEdit={() => setDepartmentModal({ mode: 'edit', department: node.department })}
                      onAssignResponsible={() =>
                        setAssignmentModal({ department: node.department, role: 'responsible' })
                      }
                      onAddAssistant={() =>
                        setAssignmentModal({ department: node.department, role: 'assistant' })
                      }
                      onDeactivate={() => {
                        Alert.alert(
                          'Desactivar departamento',
                          `Deseas desactivar "${node.department.name}"?`,
                          [
                            { text: 'Cancelar', style: 'cancel' },
                            {
                              text: 'Desactivar',
                              style: 'destructive',
                              onPress: () => void orgChart.deactivateDepartment(node.department.id),
                            },
                          ]
                        );
                      }}
                      onRemoveAssignment={(userId, role) => {
                        const assignment = orgChart.assignments.find(
                          (item) =>
                            item.departmentId === node.department.id &&
                            item.userId === userId &&
                            item.assignmentRole === role
                        );
                        if (assignment) void orgChart.removeAssignment(assignment.id);
                      }}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}

      <DepartmentModal
        state={departmentModal}
        departments={orgChart.departments}
        saving={orgChart.saving}
        onClose={() => setDepartmentModal(null)}
        onSave={async (payload) => {
          if (!departmentModal) return;
          try {
            if (departmentModal.mode === 'edit') {
              await orgChart.updateDepartment(departmentModal.department.id, payload);
            } else {
              await orgChart.createDepartment(payload);
            }
            setDepartmentModal(null);
          } catch (error) {
            Alert.alert('Error', formatFirestoreError(error));
          }
        }}
      />

      <AssignmentModal
        state={assignmentModal}
        users={orgChart.users}
        assignments={orgChart.assignments}
        saving={orgChart.saving}
        onClose={() => setAssignmentModal(null)}
        onSave={async (userId) => {
          if (!assignmentModal) return;
          try {
            if (assignmentModal.role === 'responsible') {
              await orgChart.assignResponsible(assignmentModal.department.id, userId);
            } else {
              await orgChart.addAssistant(assignmentModal.department.id, userId);
            }
            setAssignmentModal(null);
          } catch (error) {
            Alert.alert('Error', formatFirestoreError(error));
          }
        }}
      />
    </ScreenContainer>
  );
}

function OrgChartCard({
  node,
  canManage,
  saving,
  onEdit,
  onAssignResponsible,
  onAddAssistant,
  onDeactivate,
  onRemoveAssignment,
}: {
  node: OrgChartNode;
  users: AppUser[];
  canManage: boolean;
  saving: boolean;
  onEdit: () => void;
  onAssignResponsible: () => void;
  onAddAssistant: () => void;
  onDeactivate: () => void;
  onRemoveAssignment: (userId: string, role: 'responsible' | 'assistant') => void;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText style={styles.cardTitle}>{node.department.name}</ThemedText>
        {canManage ? (
          <TouchableOpacity style={styles.iconButton} onPress={onEdit} disabled={saving}>
            <Ionicons name="create-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>

      <AssignmentBlock
        label="Responsable"
        users={node.responsible ? [node.responsible] : []}
        emptyLabel="Sin responsable asignado"
        badgeColor={colors.primary}
        canManage={canManage}
        onAdd={onAssignResponsible}
        onRemove={(userId) => onRemoveAssignment(userId, 'responsible')}
      />

      <AssignmentBlock
        label="Auxiliares"
        users={node.assistants}
        emptyLabel="Sin auxiliares"
        badgeColor={colors.accent}
        canManage={canManage}
        onAdd={onAddAssistant}
        onRemove={(userId) => onRemoveAssignment(userId, 'assistant')}
      />

      {canManage ? (
        <TouchableOpacity style={styles.dangerButton} onPress={onDeactivate} disabled={saving}>
          <Ionicons name="archive-outline" size={16} color={colors.error} />
          <ThemedText style={styles.dangerButtonText}>Desactivar departamento</ThemedText>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function AssignmentBlock({
  label,
  users,
  emptyLabel,
  badgeColor,
  canManage,
  onAdd,
  onRemove,
}: {
  label: string;
  users: AppUser[];
  emptyLabel: string;
  badgeColor: string;
  canManage: boolean;
  onAdd: () => void;
  onRemove: (userId: string) => void;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.assignmentBlock}>
      <View style={styles.assignmentHeader}>
        <View style={[styles.badge, { backgroundColor: badgeColor + '20' }]}>
          <ThemedText style={[styles.badgeText, { color: badgeColor }]}>{label}</ThemedText>
        </View>
        {canManage ? (
          <TouchableOpacity style={styles.smallIconButton} onPress={onAdd}>
            <Ionicons name="add-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>
      {users.length === 0 ? (
        <ThemedText style={styles.emptyText}>{emptyLabel}</ThemedText>
      ) : (
        <View style={styles.peopleList}>
          {users.map((user) => (
            <View key={user.uid} style={styles.personPill}>
              <ThemedText style={styles.personText}>{user.displayName}</ThemedText>
              {canManage ? (
                <TouchableOpacity onPress={() => onRemove(user.uid)}>
                  <Ionicons name="close-outline" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function DepartmentModal({
  state,
  departments,
  saving,
  onClose,
  onSave,
}: {
  state: DepartmentModalState;
  departments: Department[];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: DepartmentPayload) => Promise<void>;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const [payload, setPayload] = useState<DepartmentPayload>(emptyDepartmentPayload());

  useEffect(() => {
    if (!state) return;
    setPayload(
      state.mode === 'edit'
        ? {
            name: state.department.name,
            category: state.department.category,
            parentId: state.department.parentId,
            order: state.department.order,
          }
        : emptyDepartmentPayload()
    );
  }, [state]);

  if (!state) return null;

  const valid = payload.name.trim().length > 0;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalCard}>
          <ThemedText style={styles.modalTitle}>
            {state.mode === 'edit' ? 'Editar departamento' : 'Crear departamento'}
          </ThemedText>
          <TextInput
            style={styles.input}
            value={payload.name}
            onChangeText={(name) => setPayload((current) => ({ ...current, name }))}
            placeholder="Nombre"
            placeholderTextColor={colors.textDisabled}
          />
          <View style={styles.chipWrap}>
            {DEPARTMENT_CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category}
                style={[styles.chip, payload.category === category && styles.chipActive]}
                onPress={() => setPayload((current) => ({ ...current, category }))}
              >
                <ThemedText style={[styles.chipText, payload.category === category && styles.chipTextActive]}>
                  {DEPARTMENT_CATEGORY_LABELS[category]}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={String(payload.order ?? 0)}
            onChangeText={(value) =>
              setPayload((current) => ({ ...current, order: Number(value) || 0 }))
            }
            placeholder="Orden"
            placeholderTextColor={colors.textDisabled}
            keyboardType="number-pad"
          />
          <View style={styles.chipWrap}>
            <TouchableOpacity
              style={[styles.chip, payload.parentId == null && styles.chipActive]}
              onPress={() => setPayload((current) => ({ ...current, parentId: null }))}
            >
              <ThemedText style={[styles.chipText, payload.parentId == null && styles.chipTextActive]}>
                Sin padre
              </ThemedText>
            </TouchableOpacity>
            {departments.map((department) => (
              <TouchableOpacity
                key={department.id}
                style={[styles.chip, payload.parentId === department.id && styles.chipActive]}
                onPress={() => setPayload((current) => ({ ...current, parentId: department.id }))}
              >
                <ThemedText style={[styles.chipText, payload.parentId === department.id && styles.chipTextActive]}>
                  {department.name}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
              <ThemedText style={styles.secondaryButtonText}>Cancelar</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, (!valid || saving) && styles.disabledButton]}
              disabled={!valid || saving}
              onPress={() => void onSave(payload)}
            >
              {saving ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <ThemedText style={styles.primaryButtonText}>Guardar</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AssignmentModal({
  state,
  users,
  assignments,
  saving,
  onClose,
  onSave,
}: {
  state: AssignModalState;
  users: AppUser[];
  assignments: { departmentId: string; userId: string; assignmentRole: string; isActive: boolean }[];
  saving: boolean;
  onClose: () => void;
  onSave: (userId: string) => Promise<void>;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const [selectedUserId, setSelectedUserId] = useState('');

  useEffect(() => {
    setSelectedUserId('');
  }, [state]);

  if (!state) return null;

  const assignedInDepartment = new Set(
    assignments
      .filter((assignment) => assignment.isActive && assignment.departmentId === state.department.id)
      .map((assignment) => assignment.userId)
  );
  const eligibleUsers = users.filter((user) => !assignedInDepartment.has(user.uid));

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalCard}>
          <ThemedText style={styles.modalTitle}>
            {state.role === 'responsible' ? 'Asignar responsable' : 'Agregar auxiliar'}
          </ThemedText>
          <ThemedText style={styles.modalSubtitle}>{state.department.name}</ThemedText>
          <View style={styles.userList}>
            {eligibleUsers.map((user) => (
              <TouchableOpacity
                key={user.uid}
                style={[styles.userRow, selectedUserId === user.uid && styles.userRowActive]}
                onPress={() => setSelectedUserId(user.uid)}
              >
                <ThemedText style={[styles.userName, selectedUserId === user.uid && styles.userNameActive]}>
                  {user.displayName}
                </ThemedText>
                <ThemedText style={styles.userEmail}>{user.email}</ThemedText>
              </TouchableOpacity>
            ))}
            {eligibleUsers.length === 0 ? (
              <ThemedText style={styles.emptyText}>No hay usuarios elegibles.</ThemedText>
            ) : null}
          </View>
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
              <ThemedText style={styles.secondaryButtonText}>Cancelar</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, (!selectedUserId || saving) && styles.disabledButton]}
              disabled={!selectedUserId || saving}
              onPress={() => void onSave(selectedUserId)}
            >
              <ThemedText style={styles.primaryButtonText}>Guardar</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    headerButton: {
      minHeight: 38,
      borderRadius: 12,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.primary,
    },
    headerButtonText: {
      color: colors.onPrimary,
      fontSize: 13,
      fontWeight: '800',
    },
    readOnlyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.primary + '44',
      backgroundColor: colors.primary + '12',
      borderRadius: 12,
      padding: 12,
      marginBottom: 14,
    },
    readOnlyText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '800',
    },
    categoryList: {
      gap: 16,
    },
    categorySection: {
      gap: 10,
    },
    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    categoryTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '900',
    },
    categoryCount: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
    },
    nodeGrid: {
      gap: 10,
    },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      padding: 14,
      gap: 12,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    cardTitle: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '900',
    },
    iconButton: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceRaised,
    },
    smallIconButton: {
      width: 30,
      height: 30,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundLight,
    },
    assignmentBlock: {
      gap: 8,
    },
    assignmentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
    },
    badge: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '900',
    },
    peopleList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    personPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 7,
      backgroundColor: colors.surfaceRaised,
    },
    personText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '800',
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    dangerButton: {
      minHeight: 38,
      borderRadius: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.error + '55',
      backgroundColor: colors.errorLight,
    },
    dangerButtonText: {
      color: colors.error,
      fontSize: 12,
      fontWeight: '800',
    },
    modalRoot: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    modalCard: {
      width: '100%',
      maxWidth: 520,
      maxHeight: '86%',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 16,
      gap: 12,
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '900',
    },
    modalSubtitle: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
    },
    input: {
      minHeight: 46,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundLight,
      color: colors.textPrimary,
      paddingHorizontal: 12,
      fontSize: 14,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundLight,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    chipText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    chipTextActive: {
      color: colors.onPrimary,
    },
    userList: {
      maxHeight: 320,
      gap: 8,
    },
    userRow: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundLight,
      padding: 10,
      gap: 2,
    },
    userRowActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '18',
    },
    userName: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    userNameActive: {
      color: colors.primary,
    },
    userEmail: {
      color: colors.textMuted,
      fontSize: 12,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 10,
    },
    primaryButton: {
      flex: 1,
      minHeight: 44,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontSize: 14,
      fontWeight: '900',
    },
    secondaryButton: {
      flex: 1,
      minHeight: 44,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundLight,
    },
    secondaryButtonText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '800',
    },
    disabledButton: {
      opacity: 0.55,
    },
  });
