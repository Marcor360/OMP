import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Platform, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { LoadingState } from '@/src/components/common/LoadingState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { StatusBadge, roleColor, userStatusColor } from '@/src/components/common/StatusBadge';
import { RoleGuard } from '@/src/components/common/RoleGuard';
import { ThemedText } from '@/src/components/themed-text';
import { AppColors } from '@/src/constants/app-colors';
import { getUserById, updateUser } from '@/src/services/users/users-service';
import { AppUser, ROLE_LABELS, STATUS_LABELS, UserStatus } from '@/src/types/user';
import { formatDate } from '@/src/utils/dates/dates';
import { formatFirestoreError } from '@/src/utils/errors/errors';

export function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!id) return;
    getUserById(id)
      .then((u) => {
        setUser(u);
        if (!u) setError('Usuario no encontrado.');
      })
      .catch(() => setError('Error al cargar el usuario.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleToggleStatus = async () => {
    if (!user) return;
    const newStatus: UserStatus = user.status === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'inactive' ? 'desactivar' : 'activar';

    const confirmed =
      Platform.OS === 'web'
        ? window.confirm(`¿Deseas ${action} a ${user.displayName}?`)
        : await new Promise<boolean>((resolve) =>
            Alert.alert('Confirmar', `¿Deseas ${action} a ${user.displayName}?`, [
              { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Confirmar', style: 'destructive', onPress: () => resolve(true) },
            ])
          );

    if (!confirmed) return;
    try {
      setToggling(true);
      await updateUser(user.uid, { status: newStatus });
      setUser((u) => (u ? { ...u, status: newStatus } : null));
    } catch (e) {
      Alert.alert('Error', formatFirestoreError(e));
    } finally {
      setToggling(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error || !user) return <ErrorState message={error ?? 'Usuario no encontrado.'} />;

  const initials = user.displayName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <ScreenContainer>
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
              <Ionicons name="pencil-outline" size={18} color={AppColors.primary} />
            </TouchableOpacity>
          </RoleGuard>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: roleColor[user.role] + '33' }]}>
            <ThemedText style={[styles.initials, { color: roleColor[user.role] }]}>
              {initials}
            </ThemedText>
          </View>
          <ThemedText style={styles.name}>{user.displayName}</ThemedText>
          <ThemedText style={styles.email}>{user.email}</ThemedText>
          <View style={styles.badges}>
            <StatusBadge label={ROLE_LABELS[user.role]} color={roleColor[user.role]} />
            <StatusBadge label={STATUS_LABELS[user.status]} color={userStatusColor[user.status]} />
          </View>
        </View>

        {/* Info rows */}
        <View style={styles.card}>
          <InfoRow icon="call-outline" label="Teléfono" value={user.phone ?? '—'} />
          <InfoRow icon="business-outline" label="Departamento" value={user.department ?? '—'} />
          <InfoRow icon="calendar-outline" label="Creado" value={formatDate(user.createdAt)} />
          <InfoRow icon="time-outline" label="Actualizado" value={formatDate(user.updatedAt)} />
        </View>

        {/* Actions */}
        <RoleGuard requiredRole="admin">
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              { backgroundColor: user.status === 'active' ? AppColors.error + '22' : AppColors.success + '22' },
            ]}
            onPress={handleToggleStatus}
            disabled={toggling}
            activeOpacity={0.8}
          >
            <Ionicons
              name={user.status === 'active' ? 'ban-outline' : 'checkmark-circle-outline'}
              size={18}
              color={user.status === 'active' ? AppColors.error : AppColors.success}
            />
            <ThemedText
              style={{ color: user.status === 'active' ? AppColors.error : AppColors.success, fontWeight: '600' }}
            >
              {toggling ? 'Actualizando...' : user.status === 'active' ? 'Desactivar usuario' : 'Activar usuario'}
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
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={AppColors.textMuted} />
      <ThemedText style={styles.infoLabel}>{label}</ThemedText>
      <ThemedText style={styles.infoValue}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: AppColors.textPrimary,
  },
  email: {
    fontSize: 14,
    color: AppColors.textMuted,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  infoLabel: {
    fontSize: 13,
    color: AppColors.textMuted,
    width: 110,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: AppColors.textPrimary,
    fontWeight: '500',
  },
  editBtn: {
    padding: 8,
    backgroundColor: AppColors.primary + '22',
    borderRadius: 8,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
});
