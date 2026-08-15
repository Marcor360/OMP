import React, { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { PreachingReportModal } from '@/src/components/preaching/PreachingReportModal';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import { usePreachingReport } from '@/src/hooks/usePreachingReport';
import { useI18n } from '@/src/i18n/index';
import {
  getEntriesForMonth,
  loadStore,
  markMonthlyReportAsSent,
} from '@/src/modules/field-service';
import { getCongregationDisplayName } from '@/src/services/congregations/congregations-service';
import {
  getCurrentMonthId,
  shiftMonthId,
} from '@/src/services/preaching-report.service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { isPioneer, isPreachingManager } from '@/src/types/user';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { showAlert } from '@/src/utils/ui/alerts';
import { createLogger } from '@/src/utils/logger';
import { canManageTerritories } from '@/src/utils/permissions/permissions';

const log = createLogger('preaching-screen');

const getLocalizedMonthName = (monthId: string, locale: string): string => {
  const [year, month] = monthId.split('-').map(Number);
  if (!year || !month) return monthId;

  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1)
  );
};

export function PreachingScreen() {
  const router = useRouter();
  const { reportMonth } = useLocalSearchParams<{ reportMonth?: string }>();
  const { width } = useWindowDimensions();
  const { language, t } = useI18n();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const useTwoColumns = width >= 768;
  const { appUser, congregationId, loadingProfile, profileError } = useUser();
  const [congregationName, setCongregationName] = useState(() =>
    t('preachingReport.noCongregation')
  );
  const [modalVisible, setModalVisible] = useState(false);
  const currentMonthId = getCurrentMonthId();
  const previousMonthId = shiftMonthId(currentMonthId, -1);
  const [monthId, setMonthId] = useState(currentMonthId);
  const [suggestedMinutes, setSuggestedMinutes] = useState<number | null>(null);

  const {
    report,
    loading,
    saving,
    error,
    submit,
    refresh,
  } = usePreachingReport({
    user: appUser,
    congregationName,
    monthId,
  });

  useEffect(() => {
    if (!congregationId) {
      setCongregationName(t('preachingReport.noCongregation'));
      return;
    }

    let cancelled = false;

    getCongregationDisplayName(congregationId)
      .then((name) => {
        if (!cancelled) setCongregationName(name);
      })
      .catch(() => {
        if (!cancelled) setCongregationName(congregationId);
      });

    return () => {
      cancelled = true;
    };
  }, [congregationId, t]);

  useEffect(() => {
    if (reportMonth !== previousMonthId && reportMonth !== currentMonthId) return;
    setMonthId(reportMonth);
    setModalVisible(true);
  }, [currentMonthId, previousMonthId, reportMonth]);

  useEffect(() => {
    if (!isPioneer(appUser)) {
      setSuggestedMinutes(null);
      return;
    }

    if (!appUser?.uid) {
      setSuggestedMinutes(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const { store } = await loadStore(appUser.uid);
        const [year, month] = monthId.split('-').map(Number);
        const entries = getEntriesForMonth(store, year, month);
        const total = entries.reduce((sum, entry) => sum + entry.totalMinutes, 0);
        if (!cancelled) setSuggestedMinutes(total > 0 ? total : null);
      } catch {
        if (!cancelled) setSuggestedMinutes(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appUser, monthId]);

  const handleSubmit = useCallback(
    async (...args: Parameters<typeof submit>) => {
      try {
        await submit(...args);
        if (Platform.OS !== 'web' && monthId === previousMonthId && appUser?.uid) {
          try {
            await markMonthlyReportAsSent(appUser.uid, monthId);
          } catch (markError) {
            log.warn('No se pudo marcar localmente el informe como enviado.', markError);
          }
        }
        setModalVisible(false);
        showAlert(
          t('preachingReport.sentAlertTitle'),
          t('preachingReport.sentAlertMessage')
        );
      } catch (requestError) {
        showAlert(t('common.error'), formatFirestoreError(requestError));
      }
    },
    [appUser, monthId, previousMonthId, submit, t]
  );

  if (loadingProfile || loading) {
    return <LoadingState message={t('preachingReport.loading')} />;
  }

  if (!appUser || !appUser.isActive || !congregationId) {
    return (
      <ErrorState
        message={profileError ?? t('preachingReport.activeAccountRequired')}
      />
    );
  }

  const userIsPioneer = isPioneer(appUser);
  const userIsPreachingManager = isPreachingManager(appUser);
  const userCanManageTerritories = canManageTerritories(appUser);

  return (
    <ScreenContainer
      refreshing={loading}
      onRefresh={refresh}
      contentStyle={styles.content}
    >
      <PageHeader title={t('tabs.preaching')} showBack />

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="document-text-outline" size={26} color={colors.primary} />
        </View>
        <View style={styles.heroText}>
          <ThemedText style={styles.heroTitle}>{t('fieldService.monthlyReport')}</ThemedText>
          <ThemedText style={styles.heroSubtitle}>
            {getLocalizedMonthName(monthId, language)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.monthSelector}>
        <MonthButton
          label={getLocalizedMonthName(previousMonthId, language)}
          active={monthId === previousMonthId}
          onPress={() => setMonthId(previousMonthId)}
        />
        <MonthButton
          label={getLocalizedMonthName(currentMonthId, language)}
          active={monthId === currentMonthId}
          onPress={() => setMonthId(currentMonthId)}
        />
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <ThemedText style={styles.statusTitle}>
            {report
              ? t('preachingReport.statusSent')
              : t('preachingReport.statusPending')}
          </ThemedText>
          <Ionicons
            name={report ? 'checkmark-circle-outline' : 'time-outline'}
            size={22}
            color={report ? colors.success : colors.warning}
          />
        </View>
        <ThemedText style={styles.statusText}>
          {report
            ? t('preachingReport.sentDescription')
            : t('preachingReport.pendingDescription')}
        </ThemedText>
      </View>

      <View style={styles.infoGrid}>
        <InfoPill
          icon="home-outline"
          label={t('preachingReport.congregation')}
          value={congregationName}
        />
        <InfoPill
          icon="time-outline"
          label={t('preachingReport.hours')}
          value={
            userIsPioneer
              ? t('preachingReport.hoursEnabled')
              : t('preachingReport.hoursPioneersOnly')
          }
        />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="send-outline" size={18} color={colors.onPrimary} />
        <ThemedText style={styles.primaryButtonText}>
          {report
            ? t('preachingReport.editReport')
            : t('preachingReport.sendMonthlyReport')}
        </ThemedText>
      </TouchableOpacity>

      <View style={styles.accessSection}>
        <ThemedText style={styles.accessTitle}>{t('preachingHub.accessTitle')}</ThemedText>
        <View style={styles.navGrid}>
          {userIsPioneer ? (
            <NavTile
              icon="time-outline"
              title={t('preachingHub.hoursTitle')}
              description={t('preachingHub.hoursDescription')}
              twoColumns={useTwoColumns}
              onPress={() => router.push('/(protected)/field-service')}
            />
          ) : null}

          <NavTile
            icon="map-outline"
            title={t('preachingHub.territoriesTitle')}
            description={t('preachingHub.territoriesDescription')}
            twoColumns={useTwoColumns}
            onPress={() => router.push('/(protected)/preaching/territories')}
          />

          {userIsPreachingManager ? (
            <NavTile
              icon="stats-chart-outline"
              title={t('preachingHub.managerTitle')}
              description={t('preachingHub.managerDescription')}
              twoColumns={useTwoColumns}
              onPress={() => router.push('/(protected)/preaching/manager')}
            />
          ) : null}

          {userCanManageTerritories ? (
            <NavTile
              icon="settings-outline"
              title={t('preachingHub.manageTitle')}
              description={t('preachingHub.manageDescription')}
              twoColumns={useTwoColumns}
              onPress={() => router.push('/(protected)/preaching/territories/manage')}
            />
          ) : null}
        </View>
      </View>

      <PreachingReportModal
        visible={modalVisible}
        user={appUser}
        monthName={getLocalizedMonthName(monthId, language)}
        congregationName={congregationName}
        existingReport={report}
        suggestedMinutes={suggestedMinutes}
        saving={saving}
        onClose={() => setModalVisible(false)}
        onSubmit={handleSubmit}
      />
    </ScreenContainer>
  );
}

function NavTile({
  icon,
  title,
  description,
  twoColumns,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  twoColumns: boolean;
  onPress: () => void;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <TouchableOpacity
      style={[styles.navTile, twoColumns && styles.navTileTwoColumns]}
      onPress={onPress}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.navTileIcon}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <View style={styles.navTileText}>
        <ThemedText style={styles.navTileTitle}>{title}</ThemedText>
        <ThemedText style={styles.navTileDescription} numberOfLines={1}>
          {description}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

function MonthButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <TouchableOpacity
      style={[styles.monthButton, active && styles.monthButtonActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <ThemedText style={[styles.monthButtonText, active && styles.monthButtonTextActive]}>
        {label}
      </ThemedText>
    </TouchableOpacity>
  );
}

function InfoPill({
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
    <View style={styles.infoPill}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <View style={styles.infoPillText}>
        <ThemedText style={styles.infoLabel}>{label}</ThemedText>
        <ThemedText style={styles.infoValue} numberOfLines={1}>{value}</ThemedText>
      </View>
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    content: {
      width: '100%',
      maxWidth: 720,
      alignSelf: 'center',
    },
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    heroIcon: {
      width: 52,
      height: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary + '18',
    },
    heroText: {
      flex: 1,
      minWidth: 0,
    },
    monthSelector: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
    },
    monthButton: {
      flex: 1,
      minHeight: 38,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    monthButtonText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'capitalize',
    },
    monthButtonTextActive: {
      color: colors.onPrimary,
    },
    heroTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    heroSubtitle: {
      fontSize: 13,
      color: colors.textMuted,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    statusCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      gap: 8,
      marginBottom: 12,
    },
    statusHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    statusTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    statusText: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 19,
    },
    infoGrid: {
      gap: 10,
      marginBottom: 12,
    },
    infoPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
    },
    infoPillText: {
      flex: 1,
      minWidth: 0,
    },
    infoLabel: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '700',
    },
    infoValue: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    errorBox: {
      backgroundColor: colors.error + '18',
      borderWidth: 1,
      borderColor: colors.error + '44',
      borderRadius: 10,
      padding: 12,
      marginBottom: 12,
    },
    errorText: {
      color: colors.error,
      fontSize: 13,
      fontWeight: '600',
    },
    primaryButton: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 12,
      marginBottom: 10,
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    accessSection: {
      marginTop: 8,
      gap: 10,
    },
    accessTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: '800',
    },
    navGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    navTile: {
      width: '100%',
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
    },
    navTileTwoColumns: {
      width: 'auto',
      flexBasis: '48%',
      flexGrow: 1,
    },
    navTileIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary + '18',
    },
    navTileText: {
      flex: 1,
      minWidth: 0,
    },
    navTileTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    navTileDescription: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 2,
    },
  });
