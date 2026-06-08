import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import { useI18n } from '@/src/i18n/index';
import {
  createStripeCheckoutSession,
  createStripePortalSession,
  getCongregationBillingSummary,
  getStripeBillingUsage,
  type CongregationBillingSummary,
} from '@/src/services/billing/billing-service';
import { type AppColors, useAppColors } from '@/src/styles';
import {
  BILLING_PLAN_LABELS,
  BILLING_PLAN_LIMITS,
  BILLING_PLAN_PRICES_MXN,
  BILLING_PLANS,
  type BillingPlanKey,
} from '@/src/types/billing';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import {
  canManageSubscription,
  canPaySubscription,
  canViewBilling,
} from '@/src/utils/users/billing-permissions';

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const maybeTimestamp = value as { toDate?: unknown };
    if (typeof maybeTimestamp.toDate === 'function') {
      const date = maybeTimestamp.toDate() as Date;
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }
  return null;
};

const formatDate = (value: unknown): string => {
  const date = toDate(value);
  if (!date) return '--';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const openExternalUrl = async (url: string): Promise<void> => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.assign(url);
    return;
  }

  await WebBrowser.openBrowserAsync(url);
};

export function BillingScreen() {
  const { appUser, congregationId, loadingProfile } = useUser();
  const { t } = useI18n();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const [summary, setSummary] = useState<CongregationBillingSummary | null>(null);
  const [activeUsersCount, setActiveUsersCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canView = canViewBilling(appUser);
  const canPay = canPaySubscription(appUser);
  const canManage = canManageSubscription(appUser);
  const isExempt = summary?.billingExemption?.exempt === true;

  const currentPlanLabel = useMemo(() => {
    const planKey = summary?.billing.planKey;
    return planKey ? BILLING_PLAN_LABELS[planKey] : t('billing.noActivePlan');
  }, [summary?.billing.planKey, t]);

  const refresh = useCallback(async () => {
    if (!congregationId) {
      setSummary(null);
      setError(t('billing.error.noCongregation'));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const nextSummary = await getCongregationBillingSummary(congregationId);
      setSummary(nextSummary);

      try {
        setActiveUsersCount(await getStripeBillingUsage({ congregationId }));
      } catch {
        setActiveUsersCount(null);
      }
    } catch (requestError) {
      setError(formatFirestoreError(requestError));
    } finally {
      setLoading(false);
    }
  }, [congregationId, t]);

  useEffect(() => {
    if (loadingProfile) return;
    void refresh();
  }, [loadingProfile, refresh]);

  const handleCheckout = async (planKey: BillingPlanKey) => {
    if (!congregationId) return;

    try {
      setActionLoading(planKey);
      const url = await createStripeCheckoutSession({
        congregationId,
        planKey,
      });
      await openExternalUrl(url);
    } catch (requestError) {
      Alert.alert(t('billing.error.checkoutTitle'), formatFirestoreError(requestError));
    } finally {
      setActionLoading(null);
    }
  };

  const handlePortal = async () => {
    if (!congregationId) return;

    try {
      setActionLoading('portal');
      const url = await createStripePortalSession({
        congregationId,
      });
      await openExternalUrl(url);
    } catch (requestError) {
      Alert.alert(t('billing.error.portalTitle'), formatFirestoreError(requestError));
    } finally {
      setActionLoading(null);
    }
  };

  if (loadingProfile || loading) {
    return <LoadingState message={t('billing.loading')} />;
  }

  if (!canView) {
    return <ErrorState message={t('billing.error.noPermission')} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  return (
    <ScreenContainer refreshing={loading} onRefresh={refresh}>
      <PageHeader title={t('billing.title')} subtitle={t('billing.subtitle')} showBack />

      <View style={styles.summary}>
        <View style={styles.summaryHeader}>
          <View>
            <ThemedText style={styles.eyebrow}>{t('billing.currentPlan')}</ThemedText>
            <ThemedText style={styles.title}>{currentPlanLabel}</ThemedText>
          </View>
          <View style={[styles.statusBadge, isExempt && styles.exemptBadge]}>
            <ThemedText style={[styles.statusText, isExempt && styles.exemptText]}>
              {isExempt ? t('billing.exempt') : summary?.billing.status ?? t('billing.noStatus')}
            </ThemedText>
          </View>
        </View>

        <View style={styles.metricGrid}>
          <Metric label={t('billing.nextPayment')} value={formatDate(summary?.billing.nextPaymentDate)} />
          <Metric label={t('billing.currentPeriod')} value={formatDate(summary?.billing.currentPeriodEnd)} />
          <Metric
            label={t('billing.allowedUsers')}
            value={String(summary?.billing.activeUsersLimit ?? '-')}
          />
          <Metric
            label={t('billing.activeUsers')}
            value={activeUsersCount === null ? '--' : String(activeUsersCount)}
          />
          <Metric
            label={t('billing.billingDay')}
            value={summary?.billing.billingDay ? String(summary.billing.billingDay) : '1'}
          />
          <Metric
            label={t('billing.lastPayment')}
            value={summary?.billing.lastPaymentStatus ?? '--'}
          />
        </View>
      </View>

      {isExempt ? (
        <View style={styles.notice}>
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
          <ThemedText style={styles.noticeText}>
            {t('billing.exemptNotice')}
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>{t('billing.choosePlan')}</ThemedText>
        {BILLING_PLANS.map((plan) => (
          <TouchableOpacity
            key={plan}
            style={[styles.planRow, (!canPay || isExempt) && styles.disabledRow]}
            disabled={!canPay || isExempt || Boolean(actionLoading)}
            onPress={() => void handleCheckout(plan)}
            activeOpacity={0.82}
          >
            <View>
              <ThemedText style={styles.planName}>{BILLING_PLAN_LABELS[plan]}</ThemedText>
              <ThemedText style={styles.planDescription}>
                {t('billing.planDescription', {
                  price: BILLING_PLAN_PRICES_MXN[plan],
                  limit: BILLING_PLAN_LIMITS[plan],
                })}
              </ThemedText>
            </View>
            {actionLoading === plan ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Ionicons name="card-outline" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.portalButton, (!canManage || isExempt || !summary?.billing.stripeCustomerId) && styles.disabledButton]}
          disabled={!canManage || isExempt || !summary?.billing.stripeCustomerId || Boolean(actionLoading)}
          onPress={() => void handlePortal()}
        >
          {actionLoading === 'portal' ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <>
              <Ionicons name="receipt-outline" size={18} color={colors.onPrimary} />
              <ThemedText style={styles.portalButtonText}>{t('billing.openPortal')}</ThemedText>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.metric}>
      <ThemedText style={styles.metricLabel}>{label}</ThemedText>
      <ThemedText style={styles.metricValue}>{value}</ThemedText>
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    summary: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 16,
      gap: 16,
    },
    summaryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    eyebrow: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    title: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: '800',
      marginTop: 4,
    },
    statusBadge: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      backgroundColor: colors.warningLight,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    exemptBadge: {
      backgroundColor: colors.successLight,
    },
    statusText: {
      color: colors.warningDark,
      fontSize: 12,
      fontWeight: '800',
    },
    exemptText: {
      color: colors.successDark,
    },
    metricGrid: {
      gap: 10,
    },
    metric: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 10,
    },
    metricLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    metricValue: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '800',
      marginTop: 3,
    },
    notice: {
      flexDirection: 'row',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.success + '55',
      backgroundColor: colors.successLight,
      borderRadius: 8,
      padding: 12,
      marginTop: 14,
    },
    noticeText: {
      color: colors.textPrimary,
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
    },
    section: {
      marginTop: 18,
      gap: 10,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '800',
    },
    planRow: {
      minHeight: 72,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    disabledRow: {
      opacity: 0.55,
    },
    planName: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    planDescription: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 3,
    },
    actions: {
      marginTop: 18,
    },
    portalButton: {
      minHeight: 46,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 14,
    },
    disabledButton: {
      opacity: 0.5,
    },
    portalButtonText: {
      color: colors.onPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
  });
