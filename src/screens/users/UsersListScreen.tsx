import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { UserCard } from '@/src/components/cards/UserCard';
import { LoadingState } from '@/src/components/common/LoadingState';
import { EmptyState } from '@/src/components/common/EmptyState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { RoleGuard } from '@/src/components/common/RoleGuard';
import { AppColors } from '@/src/constants/app-colors';
import { ThemedText } from '@/src/components/themed-text';
import { subscribeToUsers } from '@/src/services/users/users-service';
import { AppUser } from '@/src/types/user';
import { formatFirestoreError } from '@/src/utils/errors/errors';

export function UsersListScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setError(null);
    const unsub = subscribeToUsers((data) => {
      setUsers(data);
      setLoading(false);
      setRefreshing(false);
    });
    return unsub;
  }, []);

  const onRefresh = () => setRefreshing(true);

  if (loading) return <LoadingState message="Cargando usuarios..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <ScreenContainer refreshing={refreshing} onRefresh={onRefresh} padded={false}>
      {/* Toolbar */}
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

      {users.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="Sin usuarios"
          description="Aún no hay usuarios registrados."
          actionLabel="Crear usuario"
          onAction={() => router.push('/(protected)/users/create')}
        />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.uid}
          renderItem={({ item }) => <UserCard user={item} />}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  count: {
    fontSize: 13,
    color: AppColors.textMuted,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: AppColors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  separator: {
    height: 10,
  },
});
