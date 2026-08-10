import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Switch,
  useWindowDimensions,
  type DimensionValue,
} from 'react-native';
import { serverTimestamp, updateDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';

import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ThemedText } from '@/src/components/themed-text';
import { PermissionRow } from '@/src/components/common/PermissionRow';
import { useAppTheme } from '@/src/context/theme-context';
import { useToast } from '@/src/context/toast-context';
import { useUser } from '@/src/context/user-context';
import { type I18nContextType, useI18n } from '@/src/i18n/index';
import { LANGUAGE_DISPLAY_NAME } from '@/src/i18n/language-options';
import { usePermissions } from '@/src/hooks/use-permissions';
import { AppUser, ROLE_LABELS } from '@/src/types/user';
import { CongregationPlanUsage } from '@/src/types/congregation-plan';
import { getCongregationPlanUsage } from '@/src/services/congregations/congregations-service';
import {
  getCongregationBillingSummary,
  type CongregationBillingSummary,
} from '@/src/services/billing/billing-service';
import { type AppColors, useAppColors } from '@/src/styles';
import { type CongregationBillingState } from '@/src/types/billing';
import { userDocRef } from '@/src/lib/firebase/refs';
import { isExpoGo } from '@/src/utils/runtime';
import { canViewBilling } from '@/src/utils/users/billing-permissions';
import {
  canAccessSettings,
  canManageAssignments,
  canManageCleaning,
  canManageEvents,
  canManageMeetings,
  canManagePreachingGroups,
  canViewOwnCleaning,
  canViewUsers,
} from '@/src/utils/permissions/permissions';

const CONTENT_MAX = 1040;
const H_PADDING = 16;
const GAP = 12;

type NotificationPreferenceKey =
  | 'notificationsEnabled'
  | 'platformNotifications'
  | 'cleaningNotifications'
  | 'hospitalityNotifications'
  | 'eventsNotifications';

type NotificationPreferenceState = Record<NotificationPreferenceKey, boolean>;
type NotificationPreferencePayload = Partial<Pick<AppUser, NotificationPreferenceKey>>;

const notificationPreferencesFromUser = (user: AppUser | null): NotificationPreferenceState => ({
  notificationsEnabled: user?.notificationsEnabled !== false,
  platformNotifications: user?.platformNotifications !== false,
  cleaningNotifications: user?.cleaningNotifications !== false,
  hospitalityNotifications: user?.hospitalityNotifications !== false,
  eventsNotifications: user?.eventsNotifications !== false,
});

type ChipTone = 'success' | 'warning' | 'error' | 'info' | 'muted';
type IoniconName = keyof typeof Ionicons.glyphMap;

const getInitials = (name?: string | null): string => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '--';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase();
};

const formatBillingDate = (value: unknown): string | null => {
  const toDate = (v: unknown): Date | null => {
    if (!v) return null;
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
    if (typeof v === 'object' && v !== null && 'toDate' in v) {
      const timestampLike = v as { toDate?: unknown };
      if (typeof timestampLike.toDate === 'function') {
        const date = timestampLike.toDate();
        return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
      }
    }
    return null;
  };

  const date = toDate(value);
  return date
    ? new Intl.DateTimeFormat('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(date)
    : null;
};

export function SettingsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { appUser, congregationId, uid, refreshProfile } = useUser();
  const { showToast } = useToast();
  const { isDarkMode } = useAppTheme();
  const { t, language } = useI18n();
  const { styles } = useSettingsStyles();
  const permissions = usePermissions();
  const [planUsage, setPlanUsage] = useState<CongregationPlanUsage | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [billingSummary, setBillingSummary] = useState<CongregationBillingSummary | null>(null);
  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreferenceState>(() => notificationPreferencesFromUser(appUser));
  const [savingNotificationPreference, setSavingNotificationPreference] =
    useState<NotificationPreferenceKey | null>(null);
  const canViewCongregationPlan = canAccessSettings(appUser);
  const canViewCongregationBilling = canViewBilling(appUser);
  const canViewAdministration =
    canAccessSettings(appUser) ||
    canViewUsers(appUser) ||
    canManageMeetings(appUser) ||
    canManageAssignments(appUser) ||
    canManageCleaning(appUser) ||
    canManageEvents(appUser) ||
    canManagePreachingGroups(appUser);
  const isWide = width >= 768;
  const contentWidth = Math.max(0, Math.min(width, CONTENT_MAX) - H_PADDING * 2);
  const tileWidth = (cols: number): number | '100%' =>
    isWide ? Math.floor((contentWidth - GAP * (cols - 1)) / cols) : '100%';

  useEffect(() => {
    setNotificationPreferences(notificationPreferencesFromUser(appUser));
  }, [appUser]);

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

  useEffect(() => {
    if (!congregationId || !canViewCongregationBilling) {
      setBillingSummary(null);
      return;
    }

    let cancelled = false;
    getCongregationBillingSummary(congregationId)
      .then((summary) => {
        if (!cancelled) setBillingSummary(summary);
      })
      .catch(() => {
        if (!cancelled) setBillingSummary(null);
      });

    return () => {
      cancelled = true;
    };
  }, [canViewCongregationBilling, congregationId]);

  const handleNavigateToTheme = () => {
    router.push('/(protected)/settings/theme');
  };

  const handleNavigateToLanguage = () => {
    router.push('/(protected)/settings/language');
  };

  const handleNavigateToAbout = () => {
    router.push('/(protected)/settings/about');
  };

  const handleNavigateToBilling = () => {
    router.push('/(protected)/billing');
  };

  const handleNotificationPreferenceChange = async (
    field: NotificationPreferenceKey,
    nextValue: boolean
  ): Promise<void> => {
    if (!uid || savingNotificationPreference) return;

    const previousValue = notificationPreferences[field];
    const payload: NotificationPreferencePayload = { [field]: nextValue };
    setNotificationPreferences((current) => ({ ...current, [field]: nextValue }));
    setSavingNotificationPreference(field);

    try {
      await updateDoc(userDocRef(uid), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
      refreshProfile();
    } catch {
      setNotificationPreferences((current) => ({ ...current, [field]: previousValue }));
      showToast(t('settings.notifications.saveError'), 'error');
    } finally {
      setSavingNotificationPreference(null);
    }
  };

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <PageHeader title={t('tabs.settings')} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.wrap}>
          <View style={[styles.hero, { flexDirection: isWide ? 'row' : 'column' }]}>
            <AccountCard appUser={appUser} isWide={isWide} />
            {canViewCongregationPlan ? (
              <PlanCard
                planUsage={planUsage}
                loadingPlan={loadingPlan}
                billingSummary={billingSummary}
                showBilling={canViewCongregationBilling}
                isWide={isWide}
                onOpenBilling={handleNavigateToBilling}
              />
            ) : null}
          </View>

          {canViewAdministration ? (
            <View style={styles.section}>
              <SectionHeader
                title={t('settings.section.administration')}
                hint={t('settings.admin.permissionHint')}
              />
              <View style={styles.tileGrid}>
                {canViewUsers(appUser) ? (
                  <NavTile
                    icon="people-outline"
                    title={t('settings.admin.userManagement')}
                    description={t('settings.admin.userManagement.desc')}
                    width={tileWidth(3)}
                    onPress={() => router.push('/(protected)/(tabs)/users')}
                  />
                ) : null}
                {canManageMeetings(appUser) ? (
                  <NavTile
                    icon="calendar-outline"
                    title={t('settings.admin.meetingManagement')}
                    description={t('settings.admin.meetingManagement.desc')}
                    width={tileWidth(3)}
                    onPress={() => router.push('/(protected)/(tabs)/meetings')}
                  />
                ) : null}
                {canManageAssignments(appUser) ? (
                  <NavTile
                    icon="checkmark-done-outline"
                    title={t('settings.admin.assignmentManagement')}
                    description={t('settings.admin.assignmentManagement.desc')}
                    width={tileWidth(3)}
                    onPress={() => router.push('/(protected)/(tabs)/assignments')}
                  />
                ) : null}
                {canManageCleaning(appUser) || canViewOwnCleaning(appUser) ? (
                  <NavTile
                    icon="sparkles-outline"
                    title={t('settings.admin.cleaningGroups')}
                    description={t('settings.admin.cleaningGroups.desc')}
                    width={tileWidth(3)}
                    onPress={() => router.push('/(protected)/(tabs)/cleaning')}
                  />
                ) : null}
                <NavTile
                  icon="notifications-outline"
                  title={t('settings.admin.notifications')}
                  description={t('settings.admin.notifications.desc')}
                  width={tileWidth(3)}
                  onPress={() => router.push('/(protected)/notifications')}
                />
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <SectionHeader title={t('settings.section.activity')} />
            <View style={styles.tileGrid}>
              <NavTile
                icon="calendar-outline"
                title={t('settings.organization.meetingCalendar')}
                description={t('settings.organization.meetingCalendar.desc')}
                width={tileWidth(2)}
                onPress={() => router.push('/(protected)/(tabs)/meetings')}
              />
              <NavTile
                icon="person-outline"
                title={t('settings.organization.myAssignments')}
                description={t('settings.organization.myAssignments.desc')}
                width={tileWidth(2)}
                onPress={() => router.push('/(protected)/(tabs)/assignments')}
              />
              <NavTile
                icon="time-outline"
                title={t('settings.organization.upcomingResponsibilities')}
                description={t('settings.organization.upcomingResponsibilities.desc')}
                width={tileWidth(2)}
                onPress={() => router.push('/(protected)/(tabs)')}
              />
              <NavTile
                icon="archive-outline"
                title={t('settings.organization.assignmentHistory')}
                description={t('settings.organization.assignmentHistory.desc')}
                width={tileWidth(2)}
                onPress={() => router.push('/(protected)/(tabs)/assignments')}
              />
            </View>
          </View>

          <Section title={t('settings.section.devicePermissions')}>
            {Platform.OS === 'web' ? (
              <View style={styles.infoBox}>
                <ThemedText style={styles.infoText}>
                  {t('settings.permissions.webUnavailable')}
                </ThemedText>
              </View>
            ) : (
              <>
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
              </>
            )}
          </Section>

          <Section title={t('settings.notifications.title')}>
            <NotificationPreferenceRow
              label={t('settings.notifications.master')}
              value={notificationPreferences.notificationsEnabled}
              disabled={savingNotificationPreference !== null || !uid}
              onValueChange={(next) =>
                void handleNotificationPreferenceChange('notificationsEnabled', next)
              }
            />
            <NotificationPreferenceRow
              label={t('settings.notifications.platform')}
              value={notificationPreferences.platformNotifications}
              disabled={
                !notificationPreferences.notificationsEnabled ||
                savingNotificationPreference !== null || !uid
              }
              onValueChange={(next) => void handleNotificationPreferenceChange('platformNotifications', next)}
            />
            <NotificationPreferenceRow
              label={t('settings.notifications.cleaning')}
              value={notificationPreferences.cleaningNotifications}
              disabled={
                !notificationPreferences.notificationsEnabled ||
                savingNotificationPreference !== null || !uid
              }
              onValueChange={(next) => void handleNotificationPreferenceChange('cleaningNotifications', next)}
            />
            <NotificationPreferenceRow
              label={t('settings.notifications.hospitality')}
              value={notificationPreferences.hospitalityNotifications}
              disabled={
                !notificationPreferences.notificationsEnabled ||
                savingNotificationPreference !== null || !uid
              }
              onValueChange={(next) => void handleNotificationPreferenceChange('hospitalityNotifications', next)}
            />
            <NotificationPreferenceRow
              label={t('settings.notifications.events')}
              value={notificationPreferences.eventsNotifications}
              disabled={
                !notificationPreferences.notificationsEnabled ||
                savingNotificationPreference !== null || !uid
              }
              onValueChange={(next) => void handleNotificationPreferenceChange('eventsNotifications', next)}
            />
          </Section>

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
              value={Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '—'}
              showArrow
              onPress={handleNavigateToAbout}
            />
          </Section>

          <Section title={t('settings.section.legal')}>
            <SettingRow
              icon="information-circle-outline"
              label={t('settings.legal.about')}
              showArrow
              onPress={handleNavigateToAbout}
            />
          </Section>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const toneToColors = (colors: AppColors, tone: ChipTone): { fg: string; bg: string } => {
  switch (tone) {
    case 'success':
      return { fg: colors.success, bg: colors.successLight };
    case 'warning':
      return { fg: colors.warning, bg: colors.warningLight };
    case 'error':
      return { fg: colors.error, bg: colors.errorLight };
    case 'info':
      return { fg: colors.primary, bg: colors.infoLight };
    default:
      return { fg: colors.textMuted, bg: colors.surfaceRaised };
  }
};

const resolveBillingChip = (
  t: I18nContextType['t'],
  billing: CongregationBillingState | undefined,
  exempt: boolean
): { label: string; tone: ChipTone } => {
  if (exempt || billing?.status === 'exempt') return { label: t('billing.exempt'), tone: 'info' };
  if (!billing || !billing.enabled) return { label: t('billing.noActivePlan'), tone: 'muted' };
  const status = billing.status;
  if (status === 'active' || status === 'trialing') {
    return { label: t('billing.status.active'), tone: 'success' };
  }
  if (
    status === 'past_due' ||
    status === 'payment_action_required' ||
    status === 'unpaid' ||
    status === 'incomplete' ||
    status === 'incomplete_expired'
  ) {
    return { label: t('billing.status.pending'), tone: 'warning' };
  }
  if (status === 'canceled') return { label: t('billing.status.canceled'), tone: 'error' };
  return { label: t('billing.noStatus'), tone: 'muted' };
};

/** Paleta + hoja de estilos memoizada. `colors` es una constante de modulo, asi que la referencia es estable. */
function useSettingsStyles() {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return { colors, styles };
}

function IconBadge({ icon }: { icon: IoniconName }) {
  const { colors, styles } = useSettingsStyles();

  return (
    <View style={styles.iconBadge}>
      <Ionicons name={icon} size={20} color={colors.primary} />
    </View>
  );
}

function StatusChip({
  label,
  tone = 'info',
  showDot = false,
}: {
  label: string;
  tone?: ChipTone;
  showDot?: boolean;
}) {
  const { colors, styles } = useSettingsStyles();
  const toneColors = toneToColors(colors, tone);

  return (
    <View style={[styles.statusChip, { backgroundColor: toneColors.bg }]}>
      {showDot ? <View style={[styles.statusDot, { backgroundColor: toneColors.fg }]} /> : null}
      <ThemedText style={[styles.statusChipText, { color: toneColors.fg }]} numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  const { colors, styles } = useSettingsStyles();

  return (
    <View style={styles.sectionHeader}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      {hint ? (
        <View style={styles.sectionHint}>
          <Ionicons name="lock-closed-outline" size={14} color={colors.textDisabled} />
          <ThemedText style={styles.sectionHintText} numberOfLines={2}>
            {hint}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

function AccountCard({ appUser, isWide }: { appUser: AppUser | null; isWide: boolean }) {
  const { colors, styles } = useSettingsStyles();
  const { t } = useI18n();

  return (
    <View style={[styles.heroCard, styles.accountCard, isWide && styles.accountCardWide]}>
      <View style={styles.accountTop}>
        <View style={styles.avatar}>
          <ThemedText style={styles.avatarText}>{getInitials(appUser?.displayName)}</ThemedText>
        </View>
        <View style={styles.accountIdentity}>
          <ThemedText style={styles.accountName} numberOfLines={1}>
            {appUser?.displayName ?? '--'}
          </ThemedText>
          <ThemedText style={styles.accountEmail} numberOfLines={1}>
            {appUser?.email ?? '--'}
          </ThemedText>
        </View>
      </View>
      <View style={styles.accountDivider} />
      <View style={styles.roleRow}>
        <View style={styles.roleLabelWrap}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
          <ThemedText style={styles.roleLabel}>{t('settings.account.role')}</ThemedText>
        </View>
        <StatusChip label={appUser ? ROLE_LABELS[appUser.role] : '--'} tone="info" />
      </View>
    </View>
  );
}

interface PlanCardProps {
  planUsage: CongregationPlanUsage | null;
  loadingPlan: boolean;
  billingSummary: CongregationBillingSummary | null;
  showBilling: boolean;
  isWide: boolean;
  onOpenBilling: () => void;
}

function PlanCard({
  planUsage,
  loadingPlan,
  billingSummary,
  showBilling,
  isWide,
  onOpenBilling,
}: PlanCardProps) {
  const { colors, styles } = useSettingsStyles();
  const { t } = useI18n();

  const count = planUsage?.activeUsersCount ?? 0;
  const limit = planUsage?.activeUsersLimit ?? 0;
  const pct =
    planUsage && planUsage.activeUsersLimit > 0
      ? Math.min(100, Math.round((planUsage.activeUsersCount / planUsage.activeUsersLimit) * 100))
      : 0;
  const billing = billingSummary?.billing;
  const isExempt = billingSummary?.billingExemption?.exempt === true;
  const billingChip = resolveBillingChip(t, billing, isExempt);
  const nextPayment = formatBillingDate(billing?.nextPaymentDate ?? billing?.currentPeriodEnd);

  return (
    <View style={[styles.heroCard, styles.planCard, isWide && styles.planCardWide]}>
      <View style={styles.planHeader}>
        <View>
          <ThemedText style={styles.cardEyebrow}>{t('settings.plan.current')}</ThemedText>
          <ThemedText style={styles.planTitle} numberOfLines={1}>
            {loadingPlan ? t('settings.plan.loading') : planUsage?.planLabel ?? '--'}
          </ThemedText>
        </View>
        <StatusChip label={planUsage?.planLabel ?? '--'} tone="info" />
      </View>

      <View style={styles.planMeterBlock}>
        <View style={styles.planMeterHeader}>
          <ThemedText style={styles.planMeterLabel}>{t('settings.plan.activeUsers')}</ThemedText>
          <ThemedText style={styles.planMeterValue}>
            <ThemedText style={styles.planMeterCount}>
              {loadingPlan ? t('settings.plan.loading') : String(count)}
            </ThemedText>
            {loadingPlan ? '' : ` / ${limit}`}
          </ThemedText>
        </View>
        <View style={styles.planTrack}>
          <View style={[styles.planFill, { width: `${pct}%` }]} />
        </View>
        <ThemedText style={styles.planSubline} numberOfLines={2}>
          {planUsage
            ? `${t('settings.plan.remaining', { count: planUsage.remainingActiveUsers })} - ${t(
                'settings.plan.limit',
                { limit: planUsage.activeUsersLimit }
              )}`
            : '--'}
        </ThemedText>
      </View>

      {showBilling ? (
        <TouchableOpacity
          style={styles.billingCard}
          onPress={onOpenBilling}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('billing.title')}
        >
          <IconBadge icon="card-outline" />
          <View style={styles.billingMain}>
            <View style={styles.billingHeader}>
              <View style={styles.billingTitleBlock}>
                <ThemedText style={styles.billingTitle}>{t('billing.title')}</ThemedText>
                <ThemedText style={styles.billingSubtitle}>Stripe</ThemedText>
              </View>
              <StatusChip label={billingChip.label} tone={billingChip.tone} showDot />
            </View>
            {nextPayment ? (
              <ThemedText style={styles.billingDate} numberOfLines={1}>
                {t('billing.nextPayment')}: {nextPayment}
              </ThemedText>
            ) : null}
            <View style={styles.manageButton}>
              <ThemedText style={styles.manageButtonText}>{t('billing.manage')}</ThemedText>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </View>
          </View>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function NavTile({
  icon,
  title,
  description,
  width,
  onPress,
}: {
  icon: IoniconName;
  title: string;
  description: string;
  width: DimensionValue;
  onPress: () => void;
}) {
  const { colors, styles } = useSettingsStyles();

  return (
    <TouchableOpacity
      style={[styles.navTile, { width }]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <IconBadge icon={icon} />
      <View style={styles.navTileText}>
        <ThemedText style={styles.navTileTitle} numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText style={styles.navTileDescription} numberOfLines={2}>
          {description}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textDisabled} />
    </TouchableOpacity>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { styles } = useSettingsStyles();

  return (
    <View style={styles.section}>
      <ThemedText style={styles.legacySectionTitle}>{title}</ThemedText>
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
  icon: IoniconName;
  label: string;
  value?: string;
  showArrow?: boolean;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}) {
  const { colors, styles } = useSettingsStyles();

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress && !showArrow}
      activeOpacity={0.7}
      accessibilityRole={onPress || showArrow ? 'button' : undefined}
      accessibilityLabel={label}
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

function NotificationPreferenceRow({
  label,
  value,
  disabled,
  onValueChange,
}: {
  label: string;
  value: boolean;
  disabled: boolean;
  onValueChange: (nextValue: boolean) => void;
}) {
  const { colors, styles } = useSettingsStyles();

  return (
    <View style={[styles.preferenceRow, disabled && styles.preferenceRowDisabled]}>
      <TouchableOpacity
        style={styles.preferenceLabelButton}
        onPress={() => onValueChange(!value)}
        disabled={disabled}
        activeOpacity={0.7}
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: value, disabled }}
      >
        <ThemedText style={styles.preferenceLabel}>{label}</ThemedText>
      </TouchableOpacity>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        accessibilityLabel={label}
        trackColor={{ false: colors.border, true: colors.primary + '88' }}
        thumbColor={value ? colors.primary : colors.textDisabled}
      />
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    content: { padding: H_PADDING, gap: 20, paddingBottom: 32 },
    wrap: {
      width: '100%',
      maxWidth: CONTENT_MAX,
      alignSelf: 'center',
      gap: 20,
    },
    hero: {
      gap: 16,
    },
    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
    },
    accountCard: {
      gap: 16,
    },
    accountCardWide: {
      flex: 1,
    },
    planCard: {
      gap: 16,
    },
    planCardWide: {
      flex: 1.2,
    },
    accountTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.infoLight,
    },
    avatarText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 15,
    },
    accountIdentity: {
      flex: 1,
      minWidth: 0,
    },
    accountName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    accountEmail: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 3,
    },
    accountDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    roleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    roleLabelWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      minWidth: 0,
    },
    roleLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    planHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
    },
    cardEyebrow: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    planTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.textPrimary,
      marginTop: 4,
    },
    planMeterBlock: {
      gap: 8,
    },
    planMeterHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    planMeterLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '700',
    },
    planMeterValue: {
      fontSize: 13,
      color: colors.textMuted,
      fontWeight: '700',
    },
    planMeterCount: {
      color: colors.primary,
      fontWeight: '800',
    },
    planTrack: {
      height: 10,
      borderRadius: 999,
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    planFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    planSubline: {
      fontSize: 12,
      color: colors.textMuted,
    },
    billingCard: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 16,
      paddingBottom: 2,
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start',
    },
    billingMain: {
      flex: 1,
      minWidth: 0,
      gap: 10,
    },
    billingHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    billingTitleBlock: {
      flex: 1,
      minWidth: 0,
    },
    billingTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    billingSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    billingDate: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
    },
    manageButton: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    manageButtonText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '800',
    },
    iconBadge: {
      width: 40,
      height: 40,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.infoLight,
    },
    statusChip: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: '100%',
    },
    statusChipText: {
      fontSize: 12,
      fontWeight: '700',
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    section: { gap: 8 },
    sectionHeader: {
      gap: 6,
      paddingHorizontal: 4,
    },
    sectionTitle: {
      fontSize: 12.5,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    sectionHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sectionHintText: {
      flex: 1,
      fontSize: 12,
      color: colors.textDisabled,
    },
    tileGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GAP,
    },
    navTile: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      gap: 12,
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    navTileText: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    navTileTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    navTileDescription: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 17,
    },
    legacySectionTitle: {
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
    preferenceRow: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    preferenceRowDisabled: {
      opacity: 0.55,
    },
    preferenceLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textPrimary,
    },
    preferenceLabelButton: {
      minHeight: 44,
      flex: 1,
      justifyContent: 'center',
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
