import React from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { StatusBadge, roleColor, userStatusColor } from '@/src/components/common/StatusBadge';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import { useAuth } from '@/src/context/auth-context';
import { ROLE_LABELS, STATUS_LABELS } from '@/src/types/user';
import { formatDate } from '@/src/utils/dates/dates';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

export function ProfileScreen() {
  const { appUser } = useUser();
  const { logout } = useAuth();
  const colors = useAppColors();
  const styles = createStyles(colors);

  const handleLogout = async () => {
    const confirmed =
      Platform.OS === 'web'
        ? window.confirm('Cerrar sesion?')
        : await new Promise<boolean>((resolve) =>
            Alert.alert('Cerrar sesion', 'Estas seguro?', [
              { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Cerrar sesion', style: 'destructive', onPress: () => resolve(true) },
            ])
          );

    if (!confirmed) return;

    try {
      await logout();
    } catch {
      Alert.alert('Error', 'No se pudo cerrar sesion.');
    }
  };

  const initials = appUser?.displayName
    ? appUser.displayName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  return (
    <ScreenContainer scrollable={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: roleColor[appUser?.role ?? 'user'] + '33' }]}>
            <ThemedText style={[styles.initials, { color: roleColor[appUser?.role ?? 'user'] }]}>
              {initials}
            </ThemedText>
          </View>
          <ThemedText style={styles.name}>{appUser?.displayName ?? 'Usuario'}</ThemedText>
          <ThemedText style={styles.email}>{appUser?.email ?? '--'}</ThemedText>
          {appUser && (
            <View style={styles.badges}>
              <StatusBadge label={ROLE_LABELS[appUser.role]} color={roleColor[appUser.role]} />
              <StatusBadge label={STATUS_LABELS[appUser.status]} color={userStatusColor[appUser.status]} />
            </View>
          )}
        </View>

        <View style={styles.card}>
          <InfoRow icon="call-outline" label="Telefono" value={appUser?.phone ?? '--'} />
          <InfoRow icon="business-outline" label="Departamento" value={appUser?.department ?? '--'} />
          <InfoRow icon="calendar-outline" label="Miembro desde" value={formatDate(appUser?.createdAt)} />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <ThemedText style={styles.logoutText}>Cerrar sesion</ThemedText>
        </TouchableOpacity>
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
    content: { padding: 16, gap: 16, paddingBottom: 32 },
    avatarSection: { alignItems: 'center', gap: 8, paddingVertical: 16 },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    initials: { fontSize: 32, fontWeight: '800' },
    name: { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
    email: { fontSize: 14, color: colors.textMuted },
    badges: { flexDirection: 'row', gap: 8, marginTop: 4 },
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
    infoLabel: { fontSize: 13, color: colors.textMuted, width: 110 },
    infoValue: { flex: 1, fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
    logoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.error + '44',
      backgroundColor: colors.error + '11',
      marginTop: 8,
    },
    logoutText: { color: colors.error, fontWeight: '700', fontSize: 15 },
  });
