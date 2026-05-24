import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { StatusBadge, roleColor, userStatusColor } from '@/src/components/common/StatusBadge';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import { getCongregationDisplayName } from '@/src/services/congregations/congregations-service';
import {
  deleteUserByAdmin,
  disableUserByAdmin,
  updateUserByAdmin,
} from '@/src/services/users/admin-users-service';
import { subscribeToUser } from '@/src/services/users/users-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import {
  AppUser,
  PRIVILEGE_LABELS,
  ROLE_LABELS,
  STATUS_LABELS,
  UserStatus,
  UserGender,
} from '@/src/types/user';
import { formatDate } from '@/src/utils/dates/dates';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { isSystemPrincipalUser } from '@/src/utils/users/user-protection';
import { useI18n } from '@/src/i18n/index';
import { canViewUsers, hasPermission } from '@/src/utils/permissions/permissions';

const interpolate = (template: string, values: Record<string, string>): string =>
  Object.entries(values).reduce(
    (message, [key, value]) => message.replace(new RegExp(`\\{${key}\\}`, 'g'), value),
    template
  );

export function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { appUser, congregationId, isAdmin, loadingProfile, profileError, uid: currentUid } = useUser();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { t } = useI18n();

  const [user, setUser] = useState<AppUser | null>(null);
  const [congregationName, setCongregationName] = useState<string>('--');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const togglingRef = useRef(false);
  const deletingRef = useRef(false);

  useEffect(() => {
    if (loadingProfile) return;

    if (!id || !congregationId) {
      setUser(null);
      setCongregationName('--');
      setError(profileError ?? t('users.error.noCongregation'));
      setLoading(false);
      return;
    }

    if (!canViewUsers(appUser) && id !== currentUid) {
      setUser(null);
      setCongregationName('--');
      setError(t('users.error.noViewPermission'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToUser(
      id,
      (loadedUser) => {
        if (!loadedUser) {
          setUser(null);
          setError(t('users.error.notFound'));
          setLoading(false);
          return;
        }

        if (loadedUser.congregationId !== congregationId) {
          setUser(null);
          setError(t('users.error.noViewPermission'));
          setLoading(false);
          return;
        }

        setUser(loadedUser);
        setError(null);
        setLoading(false);
      },
      (requestError) => {
        setUser(null);
        setError(formatFirestoreError(requestError));
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [appUser, congregationId, currentUid, id, loadingProfile, profileError, t]);

  useEffect(() => {
    if (!user?.congregationId) {
      setCongregationName('--');
      return;
    }

    let cancelled = false;

    getCongregationDisplayName(user.congregationId, { forceServer: true })
      .then((resolvedName) => {
        if (cancelled) return;
        setCongregationName(resolvedName);
      })
      .catch(() => {
        if (cancelled) return;
        setCongregationName(user.congregationId);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.congregationId]);

  const handleToggleStatus = async () => {
    if (togglingRef.current) return;
    if (!user) return;

    if (!hasPermission(appUser, 'usuarios', 'edit') && !hasPermission(appUser, 'usuarios', 'manage')) {
      Alert.alert(t('users.error.insufficientPermissions'), t('users.error.adminOnlyStatus'));
      return;
    }

    const newStatus: UserStatus = user.status === 'active' ? 'inactive' : 'active';
    const action =
      newStatus === 'inactive'
        ? t('users.status.action.deactivate')
        : t('users.status.action.activate');
    const confirmMessage = interpolate(t('users.status.confirmMessage'), {
      action,
      name: user.displayName,
    });

    const confirmed =
      Platform.OS === 'web'
        ? window.confirm(confirmMessage)
        : await new Promise<boolean>((resolve) =>
            Alert.alert(t('users.status.confirmTitle'), confirmMessage, [
              { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
              { text: t('common.confirm'), style: 'destructive', onPress: () => resolve(true) },
            ])
          );

    if (!confirmed) return;

    try {
      togglingRef.current = true;
      setToggling(true);

      if (newStatus === 'inactive') {
        await disableUserByAdmin({ uid: user.uid });
      } else {
        await updateUserByAdmin({
          uid: user.uid,
          data: { isActive: true, status: 'active' },
        });
      }

      setUser((current) =>
        current
          ? {
              ...current,
              status: newStatus,
              isActive: newStatus === 'active',
            }
          : null
      );
    } catch (requestError) {
      Alert.alert('Error', formatFirestoreError(requestError));
    } finally {
      togglingRef.current = false;
      setToggling(false);
    }
  };

  const handleDeleteUser = async () => {
    if (deletingRef.current) return;
    if (!user) return;

    if (!hasPermission(appUser, 'usuarios', 'delete') && !hasPermission(appUser, 'usuarios', 'manage')) {
      Alert.alert(t('users.error.insufficientPermissions'), t('users.error.adminOnlyDelete'));
      return;
    }

    if (user.uid === currentUid) {
      Alert.alert(t('users.error.actionNotAllowed'), t('users.error.cannotDeleteSelf'));
      return;
    }

    if (user.role === 'admin' && !isAdmin) {
      Alert.alert(t('users.error.actionNotAllowed'), t('users.error.cannotDeleteAdmin'));
      return;
    }

    if (isSystemPrincipalUser(user)) {
      Alert.alert(
        t('users.error.actionNotAllowed'),
        t('users.error.cannotDeleteSystemUser')
      );
      return;
    }

    const confirmed =
      Platform.OS === 'web'
        ? window.confirm(interpolate(t('users.delete.confirmMessage'), { name: user.displayName }))
        : await new Promise<boolean>((resolve) =>
            Alert.alert(t('users.delete.confirmTitle'), interpolate(t('users.delete.confirmMessage'), { name: user.displayName }), [
              { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
              { text: t('common.delete'), style: 'destructive', onPress: () => resolve(true) },
            ])
          );

    if (!confirmed) return;

    try {
      deletingRef.current = true;
      setDeleting(true);
      await deleteUserByAdmin({ uid: user.uid });
      Alert.alert(
        t('users.delete.successTitle'),
        interpolate(t('users.delete.successMessage'), { name: user.displayName })
      );
      router.replace('/(protected)/(tabs)/users');
    } catch (requestError) {
      Alert.alert('Error', formatFirestoreError(requestError));
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };

  if (loading || loadingProfile) return <LoadingState />;
  if (error || !user) return <ErrorState message={error ?? t('users.error.notFound')} />;

  const initials = user.displayName
    .split(' ')
    .map((segment) => segment[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const isProtectedSystemUser = isSystemPrincipalUser(user);
  const canEditThisUser =
    hasPermission(appUser, 'usuarios', 'edit') || hasPermission(appUser, 'usuarios', 'manage');
  const canDeleteThisUser =
    hasPermission(appUser, 'usuarios', 'delete') || hasPermission(appUser, 'usuarios', 'manage');
  const canManageThisUser = canEditThisUser || canDeleteThisUser;

  const privilegesLabel = [
    user.privileges?.isElder ? PRIVILEGE_LABELS.isElder : null,
    user.privileges?.isMinisterialServant ? PRIVILEGE_LABELS.isMinisterialServant : null,
    user.privileges?.isRegularPioneer ? PRIVILEGE_LABELS.isRegularPioneer : null,
    user.privileges?.isAuxiliaryPioneer ? PRIVILEGE_LABELS.isAuxiliaryPioneer : null,
  ].filter(Boolean).join(', ');
  const createdByLabel = user.createdByName ?? user.createdByEmail ?? user.createdBy ?? '--';
  const updatedByLabel = user.updatedByName ?? user.updatedByEmail ?? user.updatedBy ?? createdByLabel;
  const genderLabels: Record<UserGender, string> = {

    masculino: t('users.gender.male'),
    femenino: t('users.gender.female'),
  };

  return (
    <ScreenContainer scrollable={false}>
      <PageHeader
        title={t('users.detail.title')}
        showBack
        actions={
          canEditThisUser ? (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => router.push(`/(protected)/users/edit/${user.uid}` as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="pencil-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          ) : null
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: roleColor[user.role] + '33' }]}>
            <ThemedText style={[styles.initials, { color: roleColor[user.role] }]}>{initials}</ThemedText>
          </View>
          <ThemedText style={styles.name}>{user.displayName}</ThemedText>
          <ThemedText style={styles.email}>{user.email}</ThemedText>
          <View style={styles.badges}>
            <StatusBadge label={ROLE_LABELS[user.role]} color={roleColor[user.role]} />
            <StatusBadge label={STATUS_LABELS[user.status]} color={userStatusColor[user.status]} />
          </View>
        </View>

        <View style={styles.card}>
          <InfoRow icon="call-outline" label={t('users.field.phone')} value={user.phone ?? '--'} />
          <InfoRow icon="person-outline" label={t('users.field.gender')} value={user.gender ? genderLabels[user.gender] : '--'} />
          <InfoRow icon="business-outline" label={t('users.field.department')} value={user.department ?? '--'} />
          <InfoRow icon="ribbon-outline" label={t('users.field.privileges')} value={privilegesLabel || '--'} />
          <InfoRow icon="home-outline" label={t('users.field.congregation')} value={congregationName} />
          <InfoRow icon="person-add-outline" label={t('users.field.createdBy')} value={createdByLabel} />
          <InfoRow icon="person-outline" label={t('users.field.updatedBy')} value={updatedByLabel} />
          <InfoRow icon="calendar-outline" label={t('users.field.created')} value={formatDate(user.createdAt)} />
          <InfoRow icon="time-outline" label={t('users.field.updated')} value={formatDate(user.updatedAt)} />
        </View>

        {canManageThisUser ? (
          <>
            {canEditThisUser ? (
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  {
                    backgroundColor: user.status === 'active' ? colors.error + '22' : colors.success + '22',
                  },
                ]}
                onPress={handleToggleStatus}
                disabled={toggling}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={user.status === 'active' ? 'ban-outline' : 'checkmark-circle-outline'}
                  size={18}
                  color={user.status === 'active' ? colors.error : colors.success}
                />
                <ThemedText
                  style={{
                    color: user.status === 'active' ? colors.error : colors.success,
                    fontWeight: '600',
                  }}
                >
                  {toggling
                    ? t('users.status.updating')
                    : user.status === 'active'
                      ? t('users.status.deactivate')
                      : t('users.status.activate')}
                </ThemedText>
              </TouchableOpacity>
            ) : null}

            {isProtectedSystemUser ? (
              <View style={styles.protectedNotice}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
                <ThemedText style={styles.protectedNoticeText}>
                  {t('users.detail.systemProtected')}
                </ThemedText>
              </View>
            ) : canDeleteThisUser && (isAdmin || user.role !== 'admin') ? (
              <TouchableOpacity
                style={[styles.deleteBtn, deleting && styles.deleteBtnDisabled]}
                onPress={handleDeleteUser}
                disabled={deleting}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
                <ThemedText style={styles.deleteBtnText}>
                  {deleting ? t('users.delete.deleting') : t('users.delete.action')}
                </ThemedText>
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <ThemedText style={styles.infoLabel}>{label}</ThemedText>
      <ThemedText style={styles.infoValue}>{value}</ThemedText>
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    content: {
      padding: 16,
      gap: 16,
    },
    avatarSection: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 16,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    initials: {
      fontSize: 28,
      fontWeight: '800',
    },
    name: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    email: {
      fontSize: 14,
      color: colors.textMuted,
    },
    badges: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    infoLabel: {
      fontSize: 13,
      color: colors.textMuted,
      width: 110,
    },
    infoValue: {
      flex: 1,
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: '500',
    },
    editBtn: {
      padding: 8,
      backgroundColor: colors.primary + '22',
      borderRadius: 8,
    },
    toggleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    deleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.error + '66',
      backgroundColor: colors.error + '15',
    },
    deleteBtnDisabled: {
      opacity: 0.6,
    },
    deleteBtnText: {
      color: colors.error,
      fontWeight: '600',
    },
    protectedNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary + '55',
      backgroundColor: colors.primary + '12',
    },
    protectedNoticeText: {
      flex: 1,
      color: colors.primary,
      fontWeight: '600',
    },
  });
