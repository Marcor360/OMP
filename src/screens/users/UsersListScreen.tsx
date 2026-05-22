import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { UserCard } from '@/src/components/cards/UserCard';
import { EmptyState } from '@/src/components/common/EmptyState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import { getAllUsers, subscribeToUsers } from '@/src/services/users/users-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { AppUser } from '@/src/types/user';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { useI18n } from '@/src/i18n/index';
import { canViewUsers, hasPermission } from '@/src/utils/permissions/permissions';

export function UsersListScreen() {
  const router = useRouter();
  const { appUser, congregationId, loadingProfile } = useUser();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { t } = useI18n();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadUsers = useCallback(async (forceServer = false) => {
    if (loadingProfile) return;

    if (!canViewUsers(appUser)) {
      setUsers([]);
      setError(t('users.permission.adminOnlyList'));
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (!congregationId || typeof congregationId !== 'string') {
      setUsers([]);
      setError(t('users.error.noCongregation'));
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (!forceServer) {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await getAllUsers(congregationId, {
        forceServer,
      });
      setUsers(data);
      setError(null);
    } catch (requestError) {
      console.error('UsersListScreen load error:', requestError);
      setUsers([]);
      setError(formatFirestoreError(requestError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appUser, congregationId, loadingProfile, t]);

  useEffect(() => {
    if (loadingProfile) return;

    if (!canViewUsers(appUser)) {
      setUsers([]);
      setError(t('users.permission.adminOnlyList'));
      setLoading(false);
      return;
    }

    if (!congregationId || typeof congregationId !== 'string') {
      setUsers([]);
      setError(t('users.error.noCongregation'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    return subscribeToUsers(
      congregationId,
      (data) => {
        setUsers(data);
        setError(null);
        setLoading(false);
        setRefreshing(false);
      },
      (requestError) => {
        console.error('UsersListScreen subscription error:', requestError);
        void loadUsers(true);
      }
    );
  }, [appUser, congregationId, loadUsers, loadingProfile, t]);

  const onRefresh = async () => {
    if (!congregationId) return;

    setRefreshing(true);
    await loadUsers(true);
  };

  if (loading || loadingProfile) return <LoadingState message={t('users.loading')} />;
  if (error) return <ErrorState message={error} />;

  const canCreateUsers = hasPermission(appUser, 'usuarios', 'create') || hasPermission(appUser, 'usuarios', 'manage');

  const header = (
    <>
      <View style={styles.toolbar}>
        <ThemedText style={styles.count}>
          {users.length} {users.length === 1 ? t('users.count.singular') : t('users.count.plural')}
        </ThemedText>
        {canCreateUsers ? (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/(protected)/users/create')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color={colors.onPrimary} />
            <ThemedText style={styles.addButtonText}>{t('users.action.new')}</ThemedText>
          </TouchableOpacity>
        ) : null}
      </View>

      {!canCreateUsers ? (
        <View style={styles.permissionNotice}>
          <ThemedText style={styles.permissionText}>
            {t('users.permission.adminOnlyList')}
          </ThemedText>
        </View>
      ) : null}
    </>
  );

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <FlatList
        data={users}
        keyExtractor={(item) => item.uid}
        renderItem={({ item }) => <UserCard user={item} />}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="people-outline"
              title={t('users.empty.title')}
              description={t('users.empty.description')}
              actionLabel={canCreateUsers ? t('users.action.create') : undefined}
              onAction={canCreateUsers ? () => router.push('/(protected)/users/create') : undefined}
            />
          </View>
        }
        refreshing={refreshing}
        onRefresh={onRefresh}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    toolbar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    count: {
      fontSize: 13,
      color: colors.textMuted,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
    },
    addButtonText: {
      color: colors.onPrimary,
      fontWeight: '600',
      fontSize: 14,
    },
    listContent: {
      paddingBottom: 32,
    },
    separator: {
      height: 10,
    },
    emptyWrap: {
      paddingTop: 16,
      paddingHorizontal: 16,
    },
    permissionNotice: {
      marginHorizontal: 16,
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.warning + '66',
      backgroundColor: colors.warning + '20',
      borderRadius: 10,
      padding: 12,
    },
    permissionText: {
      fontSize: 13,
      color: colors.warning,
      fontWeight: '600',
    },
  });
