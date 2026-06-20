import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { EmptyState } from '@/src/components/common/EmptyState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { StatCard } from '@/src/components/cards/StatCard';
import { ThemedText } from '@/src/components/themed-text';
import { usePreachingManagerReports } from '@/src/hooks/usePreachingManagerReports';
import {
  getMonthName,
  shiftMonthId,
} from '@/src/services/preaching-report.service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { MissingPreachingReportUser, PreachingReportSubmission } from '@/src/types/preaching-report.types';
import { PRIVILEGE_LABELS, UserPrivileges } from '@/src/types/user';
import { formatDateTime } from '@/src/utils/dates/dates';
import { useI18n } from '@/src/i18n';

interface PreachingManagerPanelProps {
  congregationId: string | null;
  enabled: boolean;
}

export function PreachingManagerPanel({ congregationId, enabled }: PreachingManagerPanelProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { t } = useI18n();

  const formatPioneerType = (submission: PreachingReportSubmission): string => {
    if (submission.pioneerType === 'regular') return t('fieldService.managerPanel.pioneerRegular');
    if (submission.pioneerType === 'auxiliary') return t('fieldService.managerPanel.pioneerAuxiliary');
    return t('fieldService.managerPanel.pioneerNone');
  };

  const privilegeLabels = (privileges?: UserPrivileges): string => {
    const labels = [
      privileges?.isElder ? PRIVILEGE_LABELS.isElder : null,
      privileges?.isMinisterialServant ? PRIVILEGE_LABELS.isMinisterialServant : null,
      privileges?.isRegularPioneer ? PRIVILEGE_LABELS.isRegularPioneer : null,
      privileges?.isAuxiliaryPioneer ? PRIVILEGE_LABELS.isAuxiliaryPioneer : null,
    ].filter(Boolean);

    return labels.length > 0 ? labels.join(', ') : t('fieldService.managerPanel.noPrivileges');
  };
  const {
    monthId,
    setMonthId,
    submissions,
    missingUsers,
    summary,
    loading,
    error,
    refresh,
  } = usePreachingManagerReports({ congregationId, enabled });

  if (!enabled) {
    return (
      <ErrorState message={t('fieldService.managerPanel.noPermissions')} />
    );
  }

  if (error) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.monthBar}>
        <TouchableOpacity
          style={styles.monthButton}
          onPress={() => setMonthId(shiftMonthId(monthId, -1))}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.monthTitleWrap}>
          <ThemedText style={styles.monthLabel}>{t('fieldService.managerPanel.selectedMonth')}</ThemedText>
          <ThemedText style={styles.monthTitle}>{getMonthName(monthId)}</ThemedText>
        </View>
        <TouchableOpacity
          style={styles.monthButton}
          onPress={() => setMonthId(shiftMonthId(monthId, 1))}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} />
          <ThemedText style={styles.loadingText}>{t('fieldService.managerPanel.loadingReports')}</ThemedText>
        </View>
      ) : null}

      <View style={styles.statsGrid}>
        <StatCard title={t('fieldService.managerPanel.publishers')} value={summary.totalActivePublishers} icon="people-outline" color={colors.primary} />
        <StatCard title={t('fieldService.managerPanel.submitted')} value={summary.totalSubmitted} icon="checkmark-circle-outline" color={colors.success} />
      </View>
      <View style={styles.statsGrid}>
        <StatCard title={t('fieldService.managerPanel.missing')} value={summary.totalMissing} icon="alert-circle-outline" color={colors.warning} />
        <StatCard title={t('fieldService.managerPanel.hours')} value={summary.totalPioneerHours} icon="time-outline" color={colors.accent} />
      </View>
      <View style={styles.statsGrid}>
        <StatCard title={t('fieldService.managerPanel.studies')} value={summary.totalBibleStudies} icon="book-outline" color={colors.secondary} />
        <StatCard title={t('fieldService.managerPanel.courses')} value={summary.totalReturnVisits} icon="return-down-forward-outline" color={colors.info} />
      </View>

      <SectionTitle title={t('fieldService.managerPanel.submittedReports')} count={submissions.length} />
      {submissions.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title={t('fieldService.managerPanel.noReports')}
          description={t('fieldService.managerPanel.noReportsDesc')}
        />
      ) : (
        <View style={styles.list}>
          {submissions.map((submission) => (
            <View key={submission.userId} style={styles.card}>
              <View style={styles.cardHeader}>
                <ThemedText style={styles.cardTitle}>{submission.userName}</ThemedText>
                <ThemedText style={styles.statusPill}>
                  {submission.participated ? t('fieldService.managerPanel.participated') : t('fieldService.managerPanel.notParticipated')}
                </ThemedText>
              </View>
              <InfoLine label={t('fieldService.managerPanel.studies')} value={String(submission.bibleStudies)} />
              <InfoLine label={t('fieldService.managerPanel.courses')} value={String(submission.returnVisits)} />
              <InfoLine label={t('fieldService.managerPanel.pioneerType')} value={formatPioneerType(submission)} />
              {submission.isPioneer ? (
                <InfoLine label={t('fieldService.managerPanel.hours')} value={String(submission.hours ?? 0)} />
              ) : null}
              {submission.comments ? (
                <InfoLine label={t('fieldService.managerPanel.comments')} value={submission.comments} />
              ) : null}
              <InfoLine label={t('fieldService.managerPanel.submissionDate')} value={formatDateTime(submission.updatedAt)} />
            </View>
          ))}
        </View>
      )}

      <SectionTitle title={t('fieldService.managerPanel.missing')} count={missingUsers.length} />
      {missingUsers.length === 0 ? (
        <EmptyState
          icon="checkmark-done-outline"
          title={t('fieldService.managerPanel.allSubmittedTitle')}
          description={t('fieldService.managerPanel.allSubmittedDesc')}
        />
      ) : (
        <View style={styles.list}>
          {missingUsers.map((user) => (
            <MissingUserCard key={user.uid} user={user} privilegeLabelsFn={privilegeLabels} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.sectionHeader}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      <ThemedText style={styles.sectionCount}>{count}</ThemedText>
    </View>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.infoLine}>
      <ThemedText style={styles.infoLabel}>{label}</ThemedText>
      <ThemedText style={styles.infoValue}>{value}</ThemedText>
    </View>
  );
}

function MissingUserCard({ user, privilegeLabelsFn }: { user: MissingPreachingReportUser, privilegeLabelsFn: (privileges?: UserPrivileges) => string }) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { t } = useI18n();

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText style={styles.cardTitle}>{user.displayName}</ThemedText>
        <ThemedText style={styles.missingPill}>{t('fieldService.managerPanel.missingReportPill')}</ThemedText>
      </View>
      <InfoLine label={t('fieldService.managerPanel.privileges')} value={privilegeLabelsFn(user.privileges)} />
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    content: {
      padding: 16,
      gap: 14,
      paddingBottom: 32,
    },
    monthBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 10,
    },
    monthButton: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceRaised,
    },
    monthTitleWrap: {
      flex: 1,
      alignItems: 'center',
      minWidth: 0,
    },
    monthLabel: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
    },
    monthTitle: {
      fontSize: 16,
      color: colors.textPrimary,
      fontWeight: '800',
      textTransform: 'capitalize',
    },
    loadingBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 12,
    },
    loadingText: {
      fontSize: 13,
      color: colors.textMuted,
    },
    statsGrid: {
      flexDirection: 'row',
      gap: 12,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    sectionCount: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textMuted,
      backgroundColor: colors.surfaceRaised,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    list: {
      gap: 10,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      gap: 8,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    cardTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    statusPill: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.success,
      backgroundColor: colors.success + '20',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    missingPill: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.warning,
      backgroundColor: colors.warning + '20',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    infoLine: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    infoLabel: {
      flex: 1,
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
    },
    infoValue: {
      flex: 1,
      fontSize: 12,
      color: colors.textPrimary,
      fontWeight: '700',
      textAlign: 'right',
    },
  });
