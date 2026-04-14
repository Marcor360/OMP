import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useCleaningAssignableUsers } from '@/src/modules/cleaning/hooks/use-cleaning-assignable-users';
import { useCleaningCache } from '@/src/modules/cleaning/context/CleaningCacheContext';
import { CleaningMemberItem } from '@/src/modules/cleaning/components/CleaningMemberItem';
import { AddMembersToCleaningGroupModal } from '@/src/modules/cleaning/screens/AddMembersToCleaningGroupModal';
import {
  addUsersToCleaningGroup,
  deactivateCleaningGroup,
  removeUserFromCleaningGroup,
} from '@/src/modules/cleaning/services/cleaning-service';
import { CleaningServiceError } from '@/src/modules/cleaning/types/cleaning-group.types';
import { LoadingState } from '@/src/components/common/LoadingState';
import { ErrorState } from '@/src/components/common/ErrorState';

interface CleaningGroupDetailScreenProps {
  groupId: string;
}

/** Pantalla de detalle y gestion de un grupo de limpieza. */
export function CleaningGroupDetailScreen({ groupId }: CleaningGroupDetailScreenProps) {
  const colors = useAppColors();
  const router = useRouter();
  const { congregationId } = useCleaningPermission();
  const { refreshAll } = useCleaningCache();

  const { group, loading, error, refresh } = useCleaningGroupDetail(groupId, congregationId);
  const { users: allUsers, refresh: refreshAssignableUsers } = useCleaningAssignableUsers(
    congregationId,
    groupId
  );

  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingMembers, setAddingMembers] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const syncCaches = useCallback(async () => {
    await refreshAssignableUsers();
    if (congregationId) {
      await refreshAll(congregationId).catch(() => undefined);
    }
    refresh();
  }, [congregationId, refresh, refreshAll, refreshAssignableUsers]);

  const memberProfiles = group
    ? group.memberIds.map((uid) => {
        const found = allUsers.find((u) => u.uid === uid);
        return {
          uid,
          displayName: found?.displayName ?? uid,
          email: found?.email,
        };
      })
    : [];

  const handleRemoveMember = useCallback(
    async (uid: string) => {
      Alert.alert(
        'Quitar integrante',
        'Estas seguro de que deseas quitar a este usuario del grupo?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Quitar',
            style: 'destructive',
            onPress: async () => {
              setRemovingUid(uid);
              setActionError(null);
              try {
                await removeUserFromCleaningGroup(groupId, uid, congregationId);
                await syncCaches();
              } catch (err) {
                setActionError(
                  err instanceof CleaningServiceError
                    ? err.message
                    : 'Error al quitar al integrante.'
                );
              } finally {
                setRemovingUid(null);
              }
            },
          },
        ]
      );
    },
    [congregationId, groupId, syncCaches]
  );

  const handleAddMembers = async (selectedIds: string[]) => {
    setAddingMembers(true);
    setActionError(null);
    try {
      await addUsersToCleaningGroup(groupId, selectedIds, group?.name, {
        congregationId,
      });
      setShowAddModal(false);
      await syncCaches();
    } catch (err) {
      setActionError(
        err instanceof CleaningServiceError ? err.message : 'Error al agregar integrantes.'
      );
    } finally {
      setAddingMembers(false);
    }
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      'Desactivar grupo',
      `Deseas desactivar el grupo "${group?.name ?? ''}"? Los integrantes quedaran liberados.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desactivar',
          style: 'destructive',
          onPress: async () => {
            setDeletingGroup(true);
            setActionError(null);
            try {
              await deactivateCleaningGroup(groupId, congregationId);
              if (congregationId) {
                await refreshAll(congregationId).catch(() => undefined);
              }
              router.back();
            } catch (err) {
              setActionError(
                err instanceof CleaningServiceError
                  ? err.message
                  : 'Error al desactivar el grupo.'
              );
              setDeletingGroup(false);
            }
          },
        },
      ]
    );
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
      paddingBottom: 6,
      gap: 12,
    },
    backBtn: { padding: 4 },
    headerTitle: {
      flex: 1,
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    editBtn: {
      padding: 6,
    },
    infoCard: {
      margin: 16,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      gap: 8,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    groupName: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
      flex: 1,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    description: {
      fontSize: 14,
      color: colors.textMuted,
      lineHeight: 20,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      fontSize: 12,
      color: colors.textMuted,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      marginTop: 4,
      marginBottom: 4,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    addMembersBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      padding: 4,
    },
    addMembersText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    membersCard: {
      marginHorizontal: 16,
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    noMembers: {
      paddingVertical: 24,
      textAlign: 'center',
      color: colors.textMuted,
      fontSize: 14,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.errorLight,
      borderRadius: 12,
      padding: 14,
      margin: 16,
      marginTop: 0,
    },
    errorText: {
      flex: 1,
      fontSize: 13,
      color: colors.error,
    },
    deleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      margin: 20,
      marginTop: 12,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: `${colors.error}40`,
      backgroundColor: colors.errorLight,
    },
    deleteBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.error,
    },
    bottomSpace: {
      height: 40,
    },
    keyboardContainer: {
      flex: 1,
    },
  });

  if (loading) return <LoadingState message="Cargando grupo..." />;
  if (error || !group) {
    return <ErrorState message={error ?? 'Grupo no encontrado.'} onRetry={refresh} />;
  }

  const isActive = group.isActive;
  const statusBg = isActive ? colors.successLight : colors.surfaceRaised;
  const statusColor = isActive ? colors.success : colors.textMuted;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
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
          <Text style={styles.headerTitle} numberOfLines={1}>
            {group.name}
          </Text>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => router.push(`/(protected)/cleaning/edit/${groupId}`)}
            accessibilityRole="button"
            accessibilityLabel="Editar grupo"
          >
            <Ionicons name="create-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.nameRow}>
            <Text style={styles.groupName} numberOfLines={2}>
              {group.name}
            </Text>
            <View style={[styles.badge, { backgroundColor: statusBg }]}>
              <Text style={[styles.badgeText, { color: statusColor }]}>
                {isActive ? 'Activo' : 'Inactivo'}
              </Text>
            </View>
          </View>

          {group.description.length > 0 && <Text style={styles.description}>{group.description}</Text>}

          <View style={styles.metaRow}>
            <Ionicons name="people-outline" size={14} color={colors.textMuted} />
            <Text style={styles.metaText}>
              {group.memberCount} {group.memberCount === 1 ? 'integrante' : 'integrantes'}
            </Text>
          </View>
        </View>

        {actionError && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
            <Text style={styles.errorText}>{actionError}</Text>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Integrantes ({group.memberCount})</Text>
          <TouchableOpacity
            style={styles.addMembersBtn}
            onPress={() => setShowAddModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Agregar integrantes"
          >
            <Ionicons name="person-add-outline" size={16} color={colors.primary} />
            <Text style={styles.addMembersText}>Agregar</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.membersCard}>
          {memberProfiles.length === 0 ? (
            <Text style={styles.noMembers}>Este grupo no tiene integrantes aun.</Text>
          ) : (
            memberProfiles.map((m) => (
              <CleaningMemberItem
                key={m.uid}
                uid={m.uid}
                displayName={m.displayName}
                email={m.email}
                onRemove={handleRemoveMember}
                removing={removingUid === m.uid}
              />
            ))
          )}
        </View>

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDeleteGroup}
          disabled={deletingGroup || !group.isActive}
          accessibilityRole="button"
          accessibilityLabel="Desactivar grupo de limpieza"
        >
          {deletingGroup ? (
            <ActivityIndicator color={colors.error} size="small" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={18} color={colors.error} />
              <Text style={styles.deleteBtnText}>Desactivar grupo</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.bottomSpace} />
      </ScrollView>
      </KeyboardAvoidingView>

      <AddMembersToCleaningGroupModal
        visible={showAddModal}
        congregationId={congregationId}
        currentGroupId={groupId}
        preSelectedIds={group.memberIds}
        onConfirm={handleAddMembers}
        onClose={() => setShowAddModal(false)}
        confirming={addingMembers}
      />
    </SafeAreaView>
  );
}
