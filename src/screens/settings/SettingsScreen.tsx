import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { PermissionRow } from '@/src/components/common/PermissionRow';
import { useAppTheme } from '@/src/context/theme-context';
import { useUser } from '@/src/context/user-context';
import { useI18n } from '@/src/i18n/index';
import { LANGUAGE_DISPLAY_NAME } from '@/src/i18n/language-options';
import { usePermissions } from '@/src/hooks/use-permissions';
import { ROLE_LABELS } from '@/src/types/user';
import { CongregationPlanUsage } from '@/src/types/congregation-plan';
import { getCongregationPlanUsage } from '@/src/services/congregations/congregations-service';
import { type AppColors, useAppColors } from '@/src/styles';
import { isExpoGo } from '@/src/utils/runtime';
import { hasPermission } from '@/src/utils/permissions/permissions';

export function SettingsScreen() {
  const router = useRouter();
  const { appUser, congregationId } = useUser();
  const { isDarkMode } = useAppTheme();
  const { t, language } = useI18n();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const permissions = usePermissions();
  const [planUsage, setPlanUsage] = useState<CongregationPlanUsage | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const canViewCongregationPlan =
    hasPermission(appUser, 'configuracion', 'view') ||
    hasPermission(appUser, 'configuracion', 'manage');
  const canViewAdministration =
    hasPermission(appUser, 'usuarios', 'view') ||
    hasPermission(appUser, 'reuniones', 'manage') ||
    hasPermission(appUser, 'asignaciones', 'manage') ||
    hasPermission(appUser, 'limpieza', 'view');

  useEffect(() => {
    if (!congregationId || !canViewCongregationPlan) {
      setPlanUsage(null);
      return;
    }

    let cancelled = false;
    setLoadingPlan(true);
    getCongregationPlanUsage(congregationId)
      .then((usage) => {
        if (!cancelled) setPlanUsage(usage);
      })
      .catch(() => {
        if (!cancelled) setPlanUsage(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingPlan(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canViewCongregationPlan, congregationId]);

  const handleNavigateToTheme = () => {
    router.push('/(protected)/settings/theme' as any);
  };

  const handleNavigateToLanguage = () => {
    router.push('/(protected)/settings/language' as any);
  };

  const handleNavigateToAbout = () => {
    router.push('/(protected)/settings/about' as any);
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

        {canViewCongregationPlan ? (
          <Section title={t('settings.section.congregationPlan')}>
            <SettingRow
              icon="business-outline"
              label={t('settings.plan.current')}
              value={loadingPlan ? t('settings.plan.loading') : planUsage?.planLabel ?? '--'}
            />
            <SettingRow
              icon="people-outline"
              label={t('settings.plan.activeUsers')}
              value={
                planUsage
                  ? `${planUsage.activeUsersCount}/${planUsage.activeUsersLimit}`
                  : '--'
              }
            />
            <SettingRow
              icon="person-add-outline"
              label={t('settings.plan.availableUsers')}
              value={planUsage ? String(planUsage.remainingActiveUsers) : '--'}
            />
          </Section>
        ) : null}

        {canViewAdministration ? (
          <Section title={t('settings.section.administration')}>
            {hasPermission(appUser, 'usuarios', 'view') ? (
              <SettingRow
              icon="people-outline"
              label={t('settings.admin.userManagement')}
              showArrow
              onPress={() => router.push('/(protected)/(tabs)/users' as any)}
            />
            ) : null}
            {hasPermission(appUser, 'reuniones', 'manage') ? (
              <SettingRow
              icon="calendar-outline"
              label={t('settings.admin.meetingManagement')}
              showArrow
              onPress={() => router.push('/(protected)/(tabs)/meetings' as any)}
            />
            ) : null}
            {hasPermission(appUser, 'asignaciones', 'manage') ? (
              <SettingRow
              icon="checkmark-done-outline"
              label={t('settings.admin.assignmentManagement')}
              showArrow
              onPress={() => router.push('/(protected)/(tabs)/assignments' as any)}
            />
            ) : null}
            {hasPermission(appUser, 'limpieza', 'view') ? (
              <SettingRow
              icon="sparkles-outline"
              label={t('settings.admin.cleaningGroups')}
              showArrow
              onPress={() => router.push('/(protected)/(tabs)/cleaning' as any)}
            />
            ) : null}
            <SettingRow
              icon="notifications-outline"
              label={t('settings.admin.notifications')}
              showArrow
              onPress={() => {
                // Placeholder: open notifications screen if needed.
              }}
            />
          </Section>
        ) : null}

        <Section title={t('settings.section.organization')}>
          <SettingRow
            icon="calendar-outline"
            label={t('settings.organization.meetingCalendar')}
            value={t('common.view')}
            showArrow
            onPress={() => router.push('/(protected)/(tabs)/meetings' as any)}
          />
          <SettingRow
            icon="person-outline"
            label={t('settings.organization.myAssignments')}
            value={t('common.view')}
            showArrow
            onPress={() => router.push('/(protected)/(tabs)/assignments' as any)}
          />
          <SettingRow
            icon="time-outline"
            label={t('settings.organization.upcomingResponsibilities')}
            value={t('common.view')}
            showArrow
            onPress={() => router.push('/(protected)/(tabs)/' as any)}
          />
          <SettingRow
            icon="archive-outline"
            label={t('settings.organization.assignmentHistory')}
            value={t('common.view')}
            showArrow
            onPress={() => router.push('/(protected)/(tabs)/assignments' as any)}
          />
        </Section>

        {Platform.OS !== 'web' ? (
          <Section title={t('settings.section.devicePermissions')}>
            {isExpoGo ? (
              <View style={styles.infoBox}>
                <ThemedText style={styles.infoText}>
                  {t('settings.permissions.expoGoUnavailable')}
                </ThemedText>
              </View>
            ) : null}
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
        ) : null}

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
            value={LANGUAGE_DISPLAY_NAME[language]}
            showArrow
            onPress={handleNavigateToLanguage}
          />
          <SettingRow
            icon="information-circle-outline"
            label={t('settings.app.version')}
            value="1.0.1"
            showArrow
            onPress={handleNavigateToAbout}
          />
        </Section>

        <Section title={t('settings.section.legal')}>
          <SettingRow
            icon="document-text-outline"
            label={t('settings.legal.terms')}
            showArrow
            onPress={() => {
              // Placeholder for terms screen.
            }}
          />
          <SettingRow
            icon="lock-closed-outline"
            label={t('settings.legal.privacy')}
            showArrow
            onPress={() => {
              // Placeholder for privacy screen.
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
    infoBox: {
      marginHorizontal: 14,
      marginTop: 14,
      marginBottom: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundLight,
    },
    infoText: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textMuted,
    },
  });
