import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { UserCard } from '@/src/components/cards/UserCard';
import { EmptyState } from '@/src/components/common/EmptyState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { RoleGuard } from '@/src/components/common/RoleGuard';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import { getAllUsers, subscribeToUsers } from '@/src/services/users/users-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { AppUser } from '@/src/types/user';
import { formatFirestoreError } from '@/src/utils/errors/errors';

export function UsersListScreen() {
  const router = useRouter();
  const { congregationId, isAdmin, loadingProfile } = useUser();
  const colors = useAppColors();
  const styles = createStyles(colors);

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!congregationId || typeof congregationId !== 'string') {
      setUsers([]);
      setError('El perfil actual no tiene congregationId.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToUsers(
      congregationId,
      (data) => {
        setUsers(data);
        setLoading(false);
        setRefreshing(false);
      },
      (snapshotError) => {
        console.error('UsersListScreen subscribe error:', snapshotError);
        setUsers([]);
        setError(formatFirestoreError(snapshotError));
        setLoading(false);
        setRefreshing(false);
      }
    );

    return unsubscribe;
  }, [congregationId]);

  const onRefresh = async () => {
    if (!congregationId) return;

    setRefreshing(true);

    try {
      const latestUsers = await getAllUsers(congregationId);
      setUsers(latestUsers);
    } catch (requestError) {
      setError(formatFirestoreError(requestError));
    } finally {
      setRefreshing(false);
    }
  };

  if (loading || loadingProfile) return <LoadingState message="Cargando usuarios..." />;
  if (error) return <ErrorState message={error} />;

  const header = (
    <>
      <View style={styles.toolbar}>
        <ThemedText style={styles.count}>
          {users.length} usuario{users.length !== 1 ? 's' : ''}
        </ThemedText>
        <RoleGuard requiredRole="admin">
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/(protected)/users/create')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <ThemedText style={styles.addButtonText}>Nuevo</ThemedText>
          </TouchableOpacity>
        </RoleGuard>
      </View>

      {!isAdmin ? (
        <View style={styles.permissionNotice}>
          <ThemedText style={styles.permissionText}>
            Solo administradores pueden crear, editar o desactivar usuarios.
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
              title="Sin usuarios"
              description="Aun no hay usuarios registrados en esta congregacion."
              actionLabel={isAdmin ? 'Crear usuario' : undefined}
              onAction={isAdmin ? () => router.push('/(protected)/users/create') : undefined}
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
      color: '#fff',
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
