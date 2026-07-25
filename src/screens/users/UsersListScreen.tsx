import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { UserCard } from '@/src/components/cards/UserCard';
import { EmptyState } from '@/src/components/common/EmptyState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import { getUsersPage } from '@/src/services/users/users-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { AppUser } from '@/src/types/user';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { useI18n } from '@/src/i18n/index';
import { canViewUsers, hasPermission } from '@/src/utils/permissions/permissions';
import { createLogger } from '@/src/utils/logger';

const log = createLogger('users-list');
const USERS_PAGE_SIZE = 20;

const mergeUsers = (current: AppUser[], incoming: AppUser[]): AppUser[] => {
  const byKey = new Map<string, AppUser>();
  [...current, ...incoming].forEach((user) => {
    const key = user.email.trim().toLowerCase() || `uid:${user.uid}`;
    const existing = byKey.get(key);
    if (!existing || (!existing.isActive && user.isActive)) byKey.set(key, user);
  });
  return Array.from(byKey.values()).sort((left, right) => {
    const leftLabel = left.displayName || left.email || left.uid;
    const rightLabel = right.displayName || right.email || right.uid;
    return leftLabel.localeCompare(rightLabel, undefined, { sensitivity: 'base' });
  });
};

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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const requestInFlightRef = useRef(false);
  const cursorRef = useRef<string | null>(null);
  const totalRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);

  const loadUsers = useCallback(async (reset = false, showInitialLoading = false) => {
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

    if (!reset && requestInFlightRef.current) return;
    const requestId = ++requestIdRef.current;
    requestInFlightRef.current = true;

    if (showInitialLoading) {
      setLoading(true);
    } else {
      setLoadingMore(!reset);
    }
    setError(null);

    try {
      const page = await getUsersPage(congregationId, {
        cursor: reset ? null : cursorRef.current,
        pageSize: USERS_PAGE_SIZE,
        includeTotal: reset || totalRef.current === null,
      });
      if (requestId !== requestIdRef.current) return;
      setUsers((current) => mergeUsers(reset ? [] : current, page.users));
      cursorRef.current = page.cursor;
      setHasMore(page.hasMore);
      if (page.total !== null) {
        setTotal(page.total);
        totalRef.current = page.total;
      }
      setError(null);
    } catch (requestError) {
      if (requestId !== requestIdRef.current) return;
      log.error('UsersListScreen load error:', requestError);
      if (reset && showInitialLoading) setUsers([]);
      setError(formatFirestoreError(requestError));
    } finally {
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
      requestInFlightRef.current = false;
    }
  }, [appUser, congregationId, loadingProfile, t]);

  useEffect(() => {
    requestIdRef.current += 1;
    requestInFlightRef.current = false;
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

    setUsers([]);
    cursorRef.current = null;
    setHasMore(false);
    setTotal(null);
    totalRef.current = null;
    void loadUsers(true, true);

    return () => {
      requestIdRef.current += 1;
      requestInFlightRef.current = false;
    };
  }, [appUser, congregationId, loadUsers, loadingProfile, t]);

  const onRefresh = async () => {
    if (!congregationId || requestInFlightRef.current) return;

    setRefreshing(true);
    await loadUsers(true, false);
  };

  const onEndReached = () => {
    if (hasMore && !loadingMore && !refreshing && !requestInFlightRef.current) {
      void loadUsers(false);
    }
  };

  if (loading || loadingProfile) return <LoadingState message={t('users.loading')} />;
  if (error && users.length === 0) {
    return <ErrorState message={error} onRetry={() => void loadUsers(true, true)} />;
  }

  const canCreateUsers = hasPermission(appUser, 'usuarios', 'create') || hasPermission(appUser, 'usuarios', 'manage');

  const header = (
    <>
      <View style={styles.toolbar}>
        <ThemedText style={styles.count}>
          {total ?? users.length} {(total ?? users.length) === 1 ? t('users.count.singular') : t('users.count.plural')}
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
      <PageHeader title={t('tabs.users')} showBack />
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
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator color={colors.primary} />
              <ThemedText style={styles.loadingMoreText}>{t('users.loadingMore')}</ThemedText>
            </View>
          ) : error ? (
            <TouchableOpacity style={styles.loadMoreError} onPress={() => void loadUsers(false)}>
              <ThemedText style={styles.loadMoreErrorText}>{error}</ThemedText>
              <ThemedText style={styles.retryText}>{t('common.retry')}</ThemedText>
            </TouchableOpacity>
          ) : null
        }
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
    loadingMore: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 18,
    },
    loadingMoreText: {
      color: colors.textMuted,
      fontSize: 13,
    },
    loadMoreError: {
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 18,
    },
    loadMoreErrorText: {
      color: colors.error,
      fontSize: 13,
      textAlign: 'center',
    },
    retryText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '700',
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
