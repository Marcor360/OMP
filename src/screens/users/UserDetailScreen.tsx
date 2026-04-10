import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { RoleGuard } from '@/src/components/common/RoleGuard';
import { StatusBadge, roleColor, userStatusColor } from '@/src/components/common/StatusBadge';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import {
  deleteUserByAdmin,
  disableUserByAdmin,
  updateUserByAdmin,
} from '@/src/services/users/admin-users-service';
import { getUserById } from '@/src/services/users/users-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { AppUser, ROLE_LABELS, STATUS_LABELS, UserStatus } from '@/src/types/user';
import { formatDate } from '@/src/utils/dates/dates';
import { formatFirestoreError } from '@/src/utils/errors/errors';

export function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { congregationId, isAdmin, loadingProfile, profileError, uid: currentUid } = useUser();
  const colors = useAppColors();
  const styles = createStyles(colors);

  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (loadingProfile) return;

    if (!id || !congregationId) {
      setError(profileError ?? 'No se encontro la congregacion del usuario actual.');
      setLoading(false);
      return;
    }

    getUserById(id)
      .then((loadedUser) => {
        if (!loadedUser) {
          setError('Usuario no encontrado.');
          return;
        }

        if (loadedUser.congregationId !== congregationId) {
          setError('No tienes permisos para ver este usuario.');
          return;
        }

        setUser(loadedUser);
      })
      .catch((requestError) => setError(formatFirestoreError(requestError)))
      .finally(() => setLoading(false));
  }, [congregationId, id, loadingProfile, profileError]);

  const handleToggleStatus = async () => {
    if (!user) return;

    if (!isAdmin) {
      Alert.alert('Permisos insuficientes', 'Solo administradores pueden cambiar el estado de usuarios.');
      return;
    }

    const newStatus: UserStatus = user.status === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'inactive' ? 'desactivar' : 'activar';

    const confirmed =
      Platform.OS === 'web'
        ? window.confirm(`Deseas ${action} a ${user.displayName}?`)
        : await new Promise<boolean>((resolve) =>
            Alert.alert('Confirmar', `Deseas ${action} a ${user.displayName}?`, [
              { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Confirmar', style: 'destructive', onPress: () => resolve(true) },
            ])
          );

    if (!confirmed) return;

    try {
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
      setToggling(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!user) return;

    if (!isAdmin) {
      Alert.alert('Permisos insuficientes', 'Solo administradores pueden eliminar usuarios.');
      return;
    }

    if (user.uid === currentUid) {
      Alert.alert('Accion no permitida', 'No puedes eliminar tu propio usuario.');
      return;
    }

    const confirmed =
      Platform.OS === 'web'
        ? window.confirm(`Deseas eliminar de forma permanente a ${user.displayName}?`)
        : await new Promise<boolean>((resolve) =>
            Alert.alert('Confirmar eliminacion', `Deseas eliminar de forma permanente a ${user.displayName}?`, [
              { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Eliminar', style: 'destructive', onPress: () => resolve(true) },
            ])
          );

    if (!confirmed) return;

    try {
      setDeleting(true);
      await deleteUserByAdmin({ uid: user.uid });
      Alert.alert('Usuario eliminado', `${user.displayName} fue eliminado correctamente.`);
      router.replace('/(protected)/(tabs)/users');
    } catch (requestError) {
      Alert.alert('Error', formatFirestoreError(requestError));
    } finally {
      setDeleting(false);
    }
  };

  if (loading || loadingProfile) return <LoadingState />;
  if (error || !user) return <ErrorState message={error ?? 'Usuario no encontrado.'} />;

  const initials = user.displayName
    .split(' ')
    .map((segment) => segment[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <ScreenContainer scrollable={false}>
      <PageHeader
        title="Detalle de usuario"
        showBack
        actions={
          <RoleGuard requiredRole="admin">
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => router.push(`/(protected)/users/edit/${user.uid}` as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="pencil-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          </RoleGuard>
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
          <InfoRow icon="call-outline" label="Telefono" value={user.phone ?? '--'} />
          <InfoRow icon="business-outline" label="Departamento" value={user.department ?? '--'} />
          <InfoRow icon="home-outline" label="Congregacion" value={user.congregationId} />
          <InfoRow icon="calendar-outline" label="Creado" value={formatDate(user.createdAt)} />
          <InfoRow icon="time-outline" label="Actualizado" value={formatDate(user.updatedAt)} />
        </View>

        <RoleGuard requiredRole="admin">
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
                ? 'Actualizando...'
                : user.status === 'active'
                  ? 'Desactivar usuario'
                  : 'Activar usuario'}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.deleteBtn, deleting && styles.deleteBtnDisabled]}
            onPress={handleDeleteUser}
            disabled={deleting}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <ThemedText style={styles.deleteBtnText}>
              {deleting ? 'Eliminando...' : 'Eliminar usuario'}
            </ThemedText>
          </TouchableOpacity>
        </RoleGuard>
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
  });
