import { View, StyleSheet, TouchableOpacity, Alert, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';

import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { StatusBadge, useStatusColors } from '@/src/components/common/StatusBadge';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import { useAuth } from '@/src/context/auth-context';
import { useI18n } from '@/src/i18n/index';
import { getCongregationDisplayName } from '@/src/services/congregations/congregations-service';
import {
  UserRole,
  UserStatus,
} from '@/src/types/user';
import { formatDate } from '@/src/utils/dates/dates';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

const joinLabels = (items: (string | null | undefined)[]): string =>
  items.filter((item): item is string => Boolean(item)).join(', ') || '--';

const roleKey: Record<UserRole, string> = {
  admin: 'role.admin',
  supervisor: 'role.supervisor',
  user: 'role.user',
};

const statusKey: Record<UserStatus, string> = {
  active: 'userStatus.active',
  inactive: 'userStatus.inactive',
  suspended: 'userStatus.suspended',
};

export function ProfileScreen() {
  const { appUser } = useUser();
  const { logout } = useAuth();
  const colors = useAppColors();
  const { roleColor, userStatusColor } = useStatusColors();
  const styles = createStyles(colors);
  const { t } = useI18n();
  const [congregationName, setCongregationName] = useState('--');

  useEffect(() => {
    const congregationId = appUser?.congregationId;
    if (!congregationId) {
      setCongregationName('--');
      return;
    }

    let cancelled = false;
    setCongregationName(t('profile.loadingCongregation'));

    getCongregationDisplayName(congregationId, { forceServer: true })
      .then((name) => {
        if (!cancelled) setCongregationName(name);
      })
      .catch(() => {
        if (!cancelled) setCongregationName(t('profile.unnamedCongregation'));
      });

    return () => {
      cancelled = true;
    };
  }, [appUser?.congregationId, t]);

  const handleLogout = async () => {
    const confirmed =
      Platform.OS === 'web'
        ? window.confirm(`${t('profile.logout.title')}?`)
        : await new Promise<boolean>((resolve) =>
            Alert.alert(t('profile.logout.title'), t('profile.logout.message'), [
              { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
              { text: t('profile.logout.title'), style: 'destructive', onPress: () => resolve(true) },
            ])
          );

    if (!confirmed) return;

    try {
      await logout();
    } catch {
      Alert.alert(t('common.error'), t('profile.logout.error'));
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
        appUser.isElder || appUser.privileges?.isElder ? t('privilege.elder') : null,
        appUser.isMinisterialServant || appUser.privileges?.isMinisterialServant
          ? t('privilege.ministerialServant')
          : null,
        appUser.privileges?.isRegularPioneer ? t('privilege.regularPioneer') : null,
        appUser.privileges?.isAuxiliaryPioneer ? t('privilege.auxiliaryPioneer') : null,
      ])
    : '--';
  const responsibilitiesLabel = appUser
    ? joinLabels([
        appUser.responsibilities?.isPreachingManager
          ? t('responsibility.preachingManager')
          : null,
      ])
    : '--';
  const yesNo = (value?: boolean): string => (value ? t('profile.yes') : t('profile.no'));

  return (
    <ScreenContainer scrollable={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: roleColor[appUser?.role ?? 'user'] + '33' }]}>
            <ThemedText style={[styles.initials, { color: roleColor[appUser?.role ?? 'user'] }]}>
              {initials}
            </ThemedText>
          </View>
          <ThemedText style={styles.name}>{appUser?.displayName ?? t('profile.defaultUser')}</ThemedText>
          <ThemedText style={styles.email}>{appUser?.email ?? '--'}</ThemedText>
          {appUser && (
            <View style={styles.badges}>
              <StatusBadge label={t(roleKey[appUser.role])} color={roleColor[appUser.role]} />
              <StatusBadge label={t(statusKey[appUser.status])} color={userStatusColor[appUser.status]} />
            </View>
          )}
        </View>

        <ProfileSection title={t('profile.section.personal')}>
          <InfoRow icon="person-outline" label={t('profile.field.name')} value={appUser?.displayName ?? '--'} />
          <InfoRow icon="mail-outline" label={t('profile.field.email')} value={appUser?.email ?? '--'} />
          <InfoRow icon="call-outline" label={t('profile.field.phone')} value={appUser?.phone ?? '--'} />
          <InfoRow icon="shield-checkmark-outline" label={t('profile.field.ompAccess')} value={appUser ? t(roleKey[appUser.role]) : '--'} />
          <InfoRow icon="pulse-outline" label={t('profile.field.status')} value={appUser ? t(statusKey[appUser.status]) : '--'} />
        </ProfileSection>

        <ProfileSection title={t('profile.section.congregation')}>
          <InfoRow icon="home-outline" label={t('profile.field.congregation')} value={congregationName} multiline />
          <InfoRow icon="business-outline" label={t('profile.field.congregationFunctions')} value={serviceAssignmentsLabel} multiline />
          <InfoRow icon="bookmark-outline" label={t('profile.field.mainFunction')} value={appUser?.department ?? '--'} multiline />
        </ProfileSection>

        <ProfileSection title={t('profile.section.appointments')}>
          <InfoRow icon="ribbon-outline" label={t('profile.field.appointmentsPrivileges')} value={privilegesLabel} multiline />
          <InfoRow icon="briefcase-outline" label={t('profile.field.additionalAssignments')} value={responsibilitiesLabel} multiline />
        </ProfileSection>

        <ProfileSection title={t('profile.section.serviceGroups')}>
          <InfoRow icon="sparkles-outline" label={t('profile.field.cleaningEligible')} value={yesNo(appUser?.cleaningEligible)} />
          <InfoRow icon="people-outline" label={t('profile.field.cleaningGroup')} value={appUser?.cleaningGroupName ?? '--'} />
        </ProfileSection>

        <ProfileSection title={t('profile.section.profileDates')}>
          <InfoRow icon="calendar-outline" label={t('profile.field.memberSince')} value={formatDate(appUser?.createdAt)} />
          <InfoRow icon="time-outline" label={t('profile.field.lastUpdated')} value={formatDate(appUser?.updatedAt)} />
        </ProfileSection>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <ThemedText style={styles.logoutText}>{t('profile.logout.title')}</ThemedText>
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
