import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Switch, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { RoleGuard } from '@/src/components/common/RoleGuard';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { PermissionRow } from '@/src/components/common/PermissionRow';
import { useAppTheme } from '@/src/context/theme-context';
import { useUser } from '@/src/context/user-context';
import { useI18n } from '@/src/i18n/index';
import { usePermissions } from '@/src/hooks/use-permissions';
import { ROLE_LABELS } from '@/src/types/user';
import { type AppColors, useAppColors } from '@/src/styles';
import { canManageUsers, canManageMeetings, canManageAssignments, canManageCleaning } from '@/src/utils/permissions/permissions';

export function SettingsScreen() {
  const router = useRouter();
  const { appUser } = useUser();
  const { isDarkMode, toggleThemeMode } = useAppTheme();
  const { t, language, setLanguage } = useI18n();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const permissions = usePermissions();

  const handleToggleTheme = async () => {
    await toggleThemeMode();
  };

  const handleNavigateToTheme = () => {
    router.push('/(protected)/settings/theme' as any);
  };

  const handleNavigateToLanguage = () => {
    router.push('/(protected)/settings/language' as any);
  };

  const handleNavigateToAbout = () => {
    router.push('/(protected)/settings/about' as any);
  };

  const handleToggleLanguage = async () => {
    const nextLanguage = language === 'es' ? 'en' : 'es';
    await setLanguage(nextLanguage);
  };

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
        <View style={styles.sectionCard}>{children}</View>
      </View>
    );
  }

  function SettingRow({
    icon,
    label,
    value,
    showArrow = false,
    onPress,
    rightElement,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value?: string;
    showArrow?: boolean;
    onPress?: () => void;
    rightElement?: React.ReactNode;
  }) {
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={onPress}
        disabled={!onPress && !showArrow}
        activeOpacity={0.7}
      >
        <Ionicons name={icon} size={18} color={colors.primary} />
        <ThemedText style={styles.rowLabel}>{label}</ThemedText>
        <View style={styles.rowRight}>
          {value ? (
            <ThemedText style={styles.rowValue} numberOfLines={1}>
              {value}
            </ThemedText>
          ) : null}
          {rightElement}
          {showArrow ? (
            <Ionicons name="chevron-forward" size={16} color={colors.textDisabled} />
          ) : null}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <ScreenContainer scrollable={false}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Cuenta ── */}
        <Section title={t('settings.section.account')}>
          <SettingRow
            icon="person-circle-outline"
            label={t('settings.account.fullName')}
            value={appUser?.displayName ?? '--'}
          />
          <SettingRow
            icon="mail-outline"
            label={t('settings.account.email')}
            value={appUser?.email ?? '--'}
          />
          <SettingRow
            icon="shield-checkmark-outline"
            label={t('settings.account.role')}
            value={appUser ? ROLE_LABELS[appUser.role] : '--'}
          />
        </Section>

        {/* ── Administración (solo admin) ── */}
        <RoleGuard requiredRole="admin">
          <Section title={t('settings.section.administration')}>
            <SettingRow
              icon="people-outline"
              label={t('settings.admin.userManagement')}
              showArrow
              onPress={() => router.push('/(protected)/users' as any)}
            />
            <SettingRow
              icon="calendar-outline"
              label={t('settings.admin.meetingManagement')}
              showArrow
              onPress={() => router.push('/(protected)/meetings' as any)}
            />
            <SettingRow
              icon="checkmark-done-outline"
              label={t('settings.admin.assignmentManagement')}
              showArrow
              onPress={() => router.push('/(protected)/assignments' as any)}
            />
            <SettingRow
              icon="sparkles-outline"
              label={t('settings.admin.cleaningGroups')}
              showArrow
              onPress={() => router.push('/(protected)/cleaning' as any)}
            />
            <SettingRow
              icon="notifications-outline"
              label={t('settings.admin.notifications')}
              showArrow
              onPress={() => {
                // Scroll to permissions section or open notifications settings
              }}
            />
          </Section>
        </RoleGuard>

        {/* ── Organización (todos los roles) ── */}
        <Section title={t('settings.section.organization')}>
          <SettingRow
            icon="calendar-outline"
            label={t('settings.organization.meetingCalendar')}
            value={t('common.view')}
            showArrow
            onPress={() => router.push('/(protected)/meetings' as any)}
          />
          <SettingRow
            icon="person-outline"
            label={t('settings.organization.myAssignments')}
            value={t('common.view')}
            showArrow
            onPress={() => router.push('/(protected)/assignments' as any)}
          />
          <SettingRow
            icon="time-outline"
            label={t('settings.organization.upcomingResponsibilities')}
            value={t('common.view')}
            showArrow
            onPress={() => router.push('/(protected)/dashboard' as any)}
          />
          <SettingRow
            icon="archive-outline"
            label={t('settings.organization.assignmentHistory')}
            value={t('common.view')}
            showArrow
            onPress={() => router.push('/(protected)/assignments' as any)}
          />
        </Section>

        {/* ── Permisos del dispositivo (solo móvil) ── */}
        {Platform.OS !== 'web' && (
          <Section title="Permisos del dispositivo">
            <PermissionRow
              icon="notifications-outline"
              title={t('permission.notifications.title')}
              description={t('permission.notifications.description')}
              status={permissions.state.notifications}
              onRequest={permissions.requestNotifications}
              onOpenSettings={permissions.openSettings}
              loading={permissions.loading}
            />
          </Section>
        )}

        {/* ── Aplicación ── */}
        <Section title={t('settings.section.application')}>
          <SettingRow
            icon="color-palette-outline"
            label={t('settings.app.theme')}
            value={isDarkMode ? t('theme.option.dark') : t('theme.option.light')}
            showArrow
            onPress={handleNavigateToTheme}
          />
          <SettingRow
            icon="language-outline"
            label={t('settings.app.language')}
            value={language === 'es' ? 'Español' : 'English'}
            showArrow
            onPress={handleNavigateToLanguage}
          />
          <SettingRow
            icon="information-circle-outline"
            label={t('settings.app.version')}
            value="1.4.1"
            showArrow
            onPress={handleNavigateToAbout}
          />
        </Section>

        {/* ── Legal ── */}
        <Section title={t('settings.section.legal')}>
          <SettingRow
            icon="document-text-outline"
            label={t('settings.legal.terms')}
            showArrow
            onPress={() => {
              // Placeholder para términos de uso
            }}
          />
          <SettingRow
            icon="lock-closed-outline"
            label={t('settings.legal.privacy')}
            showArrow
            onPress={() => {
              // Placeholder para política de privacidad
            }}
          />
          <SettingRow
            icon="information-circle-outline"
            label={t('settings.legal.about')}
            showArrow
            onPress={handleNavigateToAbout}
          />
        </Section>
      </ScrollView>
    </ScreenContainer>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    content: { padding: 16, gap: 20, paddingBottom: 32 },
    section: { gap: 8 },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      paddingHorizontal: 4,
    },
    sectionCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowLabel: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      color: colors.textPrimary,
    },
    rowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: '45%',
    },
    rowValue: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'right',
    },
  });
