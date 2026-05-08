import { View, StyleSheet, TouchableOpacity, Alert, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';

import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { StatusBadge, roleColor, userStatusColor } from '@/src/components/common/StatusBadge';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import { useAuth } from '@/src/context/auth-context';
import { getCongregationDisplayName } from '@/src/services/congregations/congregations-service';
import {
  PRIVILEGE_LABELS,
  ROLE_LABELS,
  STATUS_LABELS,
  RESPONSIBILITY_LABELS,
} from '@/src/types/user';
import { formatDate } from '@/src/utils/dates/dates';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

const yesNo = (value?: boolean): string => (value ? 'Si' : 'No');

const joinLabels = (items: (string | null | undefined)[]): string =>
  items.filter((item): item is string => Boolean(item)).join(', ') || '--';

export function ProfileScreen() {
  const { appUser } = useUser();
  const { logout } = useAuth();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const [congregationName, setCongregationName] = useState('--');

  useEffect(() => {
    const congregationId = appUser?.congregationId;
    if (!congregationId) {
      setCongregationName('--');
      return;
    }

    let cancelled = false;
    setCongregationName('Cargando...');

    getCongregationDisplayName(congregationId, { forceServer: true })
      .then((name) => {
        if (!cancelled) setCongregationName(name);
      })
      .catch(() => {
        if (!cancelled) setCongregationName('Congregacion sin nombre');
      });

    return () => {
      cancelled = true;
    };
  }, [appUser?.congregationId]);

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

  const serviceAssignmentsLabel = appUser?.serviceAssignments?.length
    ? appUser.serviceAssignments.map((assignment) => assignment.label).join(', ')
    : appUser?.department ?? '--';
  const privilegesLabel = appUser
    ? joinLabels([
        appUser.isElder || appUser.privileges?.isElder ? PRIVILEGE_LABELS.isElder : null,
        appUser.isMinisterialServant || appUser.privileges?.isMinisterialServant
          ? PRIVILEGE_LABELS.isMinisterialServant
          : null,
        appUser.privileges?.isRegularPioneer ? PRIVILEGE_LABELS.isRegularPioneer : null,
        appUser.privileges?.isAuxiliaryPioneer ? PRIVILEGE_LABELS.isAuxiliaryPioneer : null,
      ])
    : '--';
  const responsibilitiesLabel = appUser
    ? joinLabels([
        appUser.responsibilities?.isPreachingManager
          ? RESPONSIBILITY_LABELS.isPreachingManager
          : null,
      ])
    : '--';

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

        <ProfileSection title="Datos personales">
          <InfoRow icon="person-outline" label="Nombre" value={appUser?.displayName ?? '--'} />
          <InfoRow icon="mail-outline" label="Correo" value={appUser?.email ?? '--'} />
          <InfoRow icon="call-outline" label="Telefono" value={appUser?.phone ?? '--'} />
          <InfoRow icon="shield-checkmark-outline" label="Acceso en OMP" value={appUser ? ROLE_LABELS[appUser.role] : '--'} />
          <InfoRow icon="pulse-outline" label="Estado" value={appUser ? STATUS_LABELS[appUser.status] : '--'} />
        </ProfileSection>

        <ProfileSection title="Congregacion y funciones">
          <InfoRow icon="home-outline" label="Congregacion" value={congregationName} multiline />
          <InfoRow icon="business-outline" label="Funciones congregacionales" value={serviceAssignmentsLabel} multiline />
          <InfoRow icon="bookmark-outline" label="Funcion principal" value={appUser?.department ?? '--'} multiline />
        </ProfileSection>

        <ProfileSection title="Nombramientos">
          <InfoRow icon="ribbon-outline" label="Nombramientos y privilegios" value={privilegesLabel} multiline />
          <InfoRow icon="briefcase-outline" label="Encargos adicionales" value={responsibilitiesLabel} multiline />
        </ProfileSection>

        <ProfileSection title="Servicio y grupos">
          <InfoRow icon="sparkles-outline" label="Puede apoyar en limpieza" value={yesNo(appUser?.cleaningEligible)} />
          <InfoRow icon="people-outline" label="Grupo de limpieza" value={appUser?.cleaningGroupName ?? '--'} />
        </ProfileSection>

        <ProfileSection title="Fechas de perfil">
          <InfoRow icon="calendar-outline" label="Miembro desde" value={formatDate(appUser?.createdAt)} />
          <InfoRow icon="time-outline" label="Ultima actualizacion" value={formatDate(appUser?.updatedAt)} />
        </ProfileSection>

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
  multiline,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <ThemedText style={styles.infoLabel}>{label}</ThemedText>
      <ThemedText style={[styles.infoValue, multiline && styles.infoValueMultiline]}>
        {value}
      </ThemedText>
    </View>
  );
}

function ProfileSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      <View style={styles.card}>{children}</View>
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
    section: { gap: 8 },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      paddingHorizontal: 4,
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
    infoLabel: { fontSize: 13, color: colors.textMuted, width: 150 },
    infoValue: { flex: 1, fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
    infoValueMultiline: { lineHeight: 20 },
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
