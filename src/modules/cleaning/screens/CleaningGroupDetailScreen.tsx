import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '@/src/i18n/index';

import { useAppColors } from '@/src/styles';
import { useCleaningPermission } from '@/src/modules/cleaning/hooks/use-cleaning-permission';
import { useCleaningGroupDetail } from '@/src/modules/cleaning/hooks/use-cleaning-group-detail';
import { usePaginatedCleaningGroupMembers } from '@/src/modules/cleaning/hooks/use-paginated-cleaning-group-members';
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
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ActionErrorBanner } from '@/src/components/common/ActionErrorBanner';
import { useToast } from '@/src/context/toast-context';
import { confirmAlert } from '@/src/utils/ui/alerts';

interface CleaningGroupDetailScreenProps {
  groupId: string;
}

type RetryAction =
  | { type: 'add'; userIds: string[] }
  | { type: 'remove'; uid: string; displayName: string }
  | { type: 'deactivate' };

interface ActionErrorState {
  message: string;
  retry?: RetryAction;
}

/** Pantalla de detalle y gestion de un grupo de limpieza. */
export function CleaningGroupDetailScreen({ groupId }: CleaningGroupDetailScreenProps) {
  const colors = useAppColors();
  const router = useRouter();
  const { congregationId, canManage } = useCleaningPermission();
  const { refreshAll } = useCleaningCache();
  const { t } = useI18n();
  const { showToast } = useToast();

  const { group, loading, error, refresh } = useCleaningGroupDetail(groupId, congregationId);
  const {
    members,
    loading: loadingMembers,
    loadingMore: loadingMoreMembers,
    error: membersError,
    hasMore: hasMoreMembers,
    refresh: refreshMembers,
    loadMore: loadMoreMembers,
  } = usePaginatedCleaningGroupMembers(
    congregationId,
    groupId
  );

  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingMembers, setAddingMembers] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [actionError, setActionError] = useState<ActionErrorState | null>(null);

  useEffect(() => {
    if (!actionError) return;
    const timer = setTimeout(() => setActionError(null), 4000);
    return () => clearTimeout(timer);
  }, [actionError]);

  const syncCaches = useCallback(async () => {
    await Promise.all([
      congregationId ? refreshAll(congregationId).catch(() => undefined) : Promise.resolve(),
      refreshMembers(),
    ]);
    refresh();
  }, [congregationId, refresh, refreshAll, refreshMembers]);

  const goBackToCleaning = useCallback(() => {
    if (router.canGoBack?.()) {
      router.back();
      return;
    }

    router.replace('/(protected)/cleaning' as never);
  }, [router]);

  const performRemoveMember = async (uid: string, displayName: string) => {
    if (!canManage) return;
    setRemovingUid(uid);
    setActionError(null);
    try {
      await removeUserFromCleaningGroup(groupId, uid, congregationId);
      await syncCaches();
      showToast(t('cleaning.memberRemovedSuccess', { name: displayName }), 'success');
    } catch (err) {
      setActionError({
        message:
          err instanceof CleaningServiceError
            ? err.message
            : t('cleaning.errorRemoveMember'),
        retry: { type: 'remove', uid, displayName },
      });
    } finally {
      setRemovingUid(null);
    }
  };

  const handleRemoveMember = async (uid: string) => {
    if (!canManage || removingUid) return;
    const displayName = members.find((member) => member.uid === uid)?.displayName ?? uid;
    const confirmed = await confirmAlert({
      title: t('cleaning.removeMemberTitle'),
      message: t('cleaning.removeMemberConfirm', { name: displayName }),
      confirmLabel: t('cleaning.removeBtn'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (confirmed) await performRemoveMember(uid, displayName);
  };

  const performAddMembers = async (selectedIds: string[]) => {
    if (!canManage) return;
    setAddingMembers(true);
    setActionError(null);
    try {
      const result = await addUsersToCleaningGroup(groupId, selectedIds, congregationId);
      setShowAddModal(false);
      await syncCaches();
      if (result.added > 0) {
        showToast(
          t(
            result.added === 1
              ? 'cleaning.membersAddedSuccess'
              : 'cleaning.membersAddedSuccess_plural',
            { count: result.added }
          ),
          'success'
        );
      } else {
        showToast(t('cleaning.noMembersAdded'), 'info');
      }
    } catch (err) {
      setShowAddModal(false);
      setActionError({
        message:
          err instanceof CleaningServiceError ? err.message : t('cleaning.errorAddMembers'),
        retry: { type: 'add', userIds: selectedIds },
      });
    } finally {
      setAddingMembers(false);
    }
  };

  const handleRetryAction = () => {
    const retry = actionError?.retry;
    setActionError(null);
    if (!retry) return;

    if (retry.type === 'add') {
      void performAddMembers(retry.userIds);
      return;
    }
    if (retry.type === 'deactivate') {
      void performDeactivateGroup();
      return;
    }
    void performRemoveMember(retry.uid, retry.displayName);
  };

  const performDeactivateGroup = async () => {
    if (!canManage) return;
    setDeletingGroup(true);
    setActionError(null);
    try {
      await deactivateCleaningGroup(groupId, congregationId);
      if (congregationId) {
        await refreshAll(congregationId).catch(() => undefined);
      }
      goBackToCleaning();
    } catch (err) {
      setActionError({
        message:
          err instanceof CleaningServiceError ? err.message : t('cleaning.errorDeactivate'),
        retry: { type: 'deactivate' },
      });
      setDeletingGroup(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!canManage) return;
    const confirmed = await confirmAlert({
      title: t('cleaning.deactivateGroup'),
      message: t('cleaning.deactivateGroupConfirm', { name: group?.name ?? '' }),
      confirmLabel: t('cleaning.deactivateBtn'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (confirmed) await performDeactivateGroup();
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
    memberRowCard: {
      marginHorizontal: 16,
      marginBottom: 8,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
    },
    membersStateCard: {
      marginHorizontal: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 20,
      paddingVertical: 24,
    },
    noMembers: {
      textAlign: 'center',
      color: colors.textMuted,
      fontSize: 14,
    },
    membersRetry: {
      minHeight: 44,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      backgroundColor: `${colors.primary}18`,
    },
    membersRetryText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    membersFooter: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 20,
    },
    membersFooterText: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: 'center',
    },
    actionBannerWrap: {
      marginHorizontal: 16,
      marginBottom: 12,
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
    scrollContent: {
      paddingBottom: 16,
    },
    keyboardContainer: {
      flex: 1,
    },
  });

  if (loading) return <LoadingState message={t('cleaning.loadingGroup')} />;
  if (error || !group) {
    return <ErrorState message={error ?? t('cleaning.groupNotFound')} onRetry={refresh} />;
  }

  const isActive = group.isActive;
  const isFamilyGroup = group.groupType === 'family';
  const statusBg = isActive ? colors.successLight : colors.surfaceRaised;
  const statusColor = isActive ? colors.success : colors.textMuted;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <FlatList
        data={members}
        keyExtractor={(member) => member.uid}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onEndReached={hasMoreMembers ? loadMoreMembers : undefined}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <View style={styles.memberRowCard}>
            <CleaningMemberItem
              uid={item.uid}
              displayName={item.displayName}
              email={item.email}
              onRemove={canManage ? handleRemoveMember : undefined}
              removing={removingUid === item.uid}
              disabled={removingUid !== null}
              showSeparator={false}
            />
          </View>
        )}
        ListHeaderComponent={
          <>
            <PageHeader
              title={group.name}
              showBack
              actions={
                canManage ? (
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => router.push(`/(protected)/cleaning/edit/${groupId}`)}
                    accessibilityRole="button"
                    accessibilityLabel={t('cleaning.editGroup')}
                  >
                    <Ionicons name="create-outline" size={22} color={colors.primary} />
                  </TouchableOpacity>
                ) : undefined
              }
            />

            <View style={styles.infoCard}>
              <View style={styles.nameRow}>
                <Text style={styles.groupName} numberOfLines={2}>
                  {group.name}
                </Text>
                <View style={[styles.badge, { backgroundColor: statusBg }]}>
                  <Text style={[styles.badgeText, { color: statusColor }]}>
                    {isActive ? t('cleaning.statusActive') : t('cleaning.statusInactive')}
                  </Text>
                </View>
              </View>

              {group.description.length > 0 ? (
                <Text style={styles.description}>{group.description}</Text>
              ) : null}

              <View style={styles.metaRow}>
                <Ionicons
                  name={isFamilyGroup ? 'home-outline' : 'sparkles-outline'}
                  size={14}
                  color={colors.textMuted}
                />
                <Text style={styles.metaText}>
                  {isFamilyGroup ? t('cleaning.typeFamily') : t('cleaning.typeStandard')}
                </Text>
              </View>
            </View>

            {actionError ? (
              <View style={styles.actionBannerWrap}>
                <ActionErrorBanner
                  message={actionError.message}
                  retryLabel={actionError.retry ? t('common.retry') : undefined}
                  dismissLabel={t('cleaning.dismissError')}
                  onRetry={actionError.retry ? handleRetryAction : undefined}
                  onDismiss={() => setActionError(null)}
                />
              </View>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>
                {t('cleaning.membersSection', { count: group.memberCount })}
              </Text>
              {canManage ? (
                <TouchableOpacity
                  style={styles.addMembersBtn}
                  onPress={() => setShowAddModal(true)}
                  disabled={addingMembers || removingUid !== null}
                  accessibilityRole="button"
                  accessibilityLabel={t('cleaning.addMembersModalTitle')}
                  accessibilityState={{ disabled: addingMembers || removingUid !== null }}
                >
                  <Ionicons name="person-add-outline" size={16} color={colors.primary} />
                  <Text style={styles.addMembersText}>{t('cleaning.addMembers')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.membersStateCard}>
            {loadingMembers ? (
              <>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.noMembers}>{t('cleaning.loadingMembers')}</Text>
              </>
            ) : membersError ? (
              <>
                <Text style={styles.noMembers}>{membersError}</Text>
                <TouchableOpacity
                  style={styles.membersRetry}
                  onPress={() => void refreshMembers()}
                  accessibilityRole="button"
                >
                  <Text style={styles.membersRetryText}>{t('common.retry')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.noMembers}>{t('cleaning.noMembersYet')}</Text>
            )}
          </View>
        }
        ListFooterComponent={
          <>
            {loadingMoreMembers ? (
              <View style={styles.membersFooter}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={styles.membersFooterText}>{t('cleaning.loadingMoreMembers')}</Text>
              </View>
            ) : membersError && members.length > 0 ? (
              <View style={styles.membersStateCard}>
                <Text style={styles.noMembers}>{membersError}</Text>
                <TouchableOpacity
                  style={styles.membersRetry}
                  onPress={loadMoreMembers}
                  accessibilityRole="button"
                >
                  <Text style={styles.membersRetryText}>{t('common.retry')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {canManage ? (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDeleteGroup}
                disabled={deletingGroup || !group.isActive || removingUid !== null}
                accessibilityRole="button"
                accessibilityLabel={t('cleaning.deactivateGroup')}
                accessibilityState={{
                  disabled: deletingGroup || !group.isActive || removingUid !== null,
                }}
              >
                {deletingGroup ? (
                  <ActivityIndicator color={colors.error} size="small" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                    <Text style={styles.deleteBtnText}>{t('cleaning.deactivateGroup')}</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
          </>
        }
      />
      </KeyboardAvoidingView>

      {showAddModal ? (
        <AddMembersToCleaningGroupModal
          visible
          congregationId={congregationId}
          currentGroupId={groupId}
          preSelectedIds={group.memberIds}
          onConfirm={performAddMembers}
          onClose={() => setShowAddModal(false)}
          confirming={addingMembers}
        />
      ) : null}
    </SafeAreaView>
  );
}
