/**
 * Pantalla completa del Módulo: Contador de Horas de Predicación.
 *
 * - Encabezado con nombre del módulo
 * - Resumen del mes actual
 * - Resumen semanal de la semana seleccionada
 * - Calendario mensual lun-sáb con navegación
 * - Modal de captura/edición al tocar un día
 * - Aviso automático si se ejecutó purga semestral
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/src/i18n/index';

import { useAppColors } from '@/src/styles';
import { useUser } from '@/src/context/user-context';
import { isPioneer } from '@/src/types/user';
import { LoadingState } from '@/src/components/common/LoadingState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { EmptyState } from '@/src/components/common/EmptyState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { useFieldService } from '@/src/modules/field-service/hooks/use-field-service';
import { FieldServiceCalendar } from '@/src/modules/field-service/components/FieldServiceCalendar';
import { FieldServiceDayModal } from '@/src/modules/field-service/components/FieldServiceDayModal';
import { FieldServiceWeekSummary } from '@/src/modules/field-service/components/FieldServiceWeekSummary';
import {
  formatMinutes,
  formatMonthHeader,
  isSunday,
  parseLocalDate,
  todayLocal,
} from '@/src/modules/field-service/utils/field-service-dates';
import type { SaveDayInput } from '@/src/modules/field-service/types/field-service.types';

// ─── Componente ───────────────────────────────────────────────────────────────

export function FieldServiceScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useI18n();
  const { appUser } = useUser();

  // Estado local de navegación del calendario
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);

  // Día seleccionado en el calendario
  const [selectedDate, setSelectedDate] = useState<string | null>(todayLocal());

  // Modal de captura
  const [modalVisible, setModalVisible] = useState(false);
  const {
    loading,
    error,
    purgeExecutedThisSession,
    getWeekSummaryForDate,
    getMonthSummaryFor,
    buildCalendar,
    getDayMinutes,
    monthlyReportStatus,
    saveDay,
    removeDay,
    reload,
    navigateMonth,
  } = useFieldService();

  // Construir calendario del mes visualizado
  const calendar = useMemo(
    () => buildCalendar(calYear, calMonth),
    [buildCalendar, calYear, calMonth]
  );

  // Resumen mensual del mes visualizado (puede ser diferente al mes actual)
  const visibleMonthSummary = useMemo(
    () => getMonthSummaryFor(calYear, calMonth),
    [getMonthSummaryFor, calYear, calMonth]
  );

  // Resumen semanal del día seleccionado
  const weekSummary = useMemo(() => {
    const base = selectedDate ? parseLocalDate(selectedDate) : new Date();
    return getWeekSummaryForDate(base);
  }, [getWeekSummaryForDate, selectedDate]);

  // Minutos del día seleccionado
  const selectedDayMinutes = useMemo(
    () => (selectedDate ? getDayMinutes(selectedDate) : 0),
    [getDayMinutes, selectedDate]
  );

  const reportMonthLabel = useMemo(() => {
    if (!monthlyReportStatus) return '';
    return formatMonthHeader(
      monthlyReportStatus.window.targetYear,
      monthlyReportStatus.window.targetMonth
    );
  }, [monthlyReportStatus]);

  const reportMonthSummary = useMemo(() => {
    if (!monthlyReportStatus) return null;
    return getMonthSummaryFor(
      monthlyReportStatus.window.targetYear,
      monthlyReportStatus.window.targetMonth
    );
  }, [monthlyReportStatus, getMonthSummaryFor]);

  const reportDeadlineLabel = useMemo(() => {
    if (!monthlyReportStatus) return '';
    return parseLocalDate(monthlyReportStatus.window.windowEnd).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
    });
  }, [monthlyReportStatus]);

  // Navegar entre meses
  const handlePrevMonth = useCallback(() => {
    const { year, month } = navigateMonth(calYear, calMonth, 'prev');
    setCalYear(year);
    setCalMonth(month);
  }, [calYear, calMonth, navigateMonth]);

  const handleNextMonth = useCallback(() => {
    const { year, month } = navigateMonth(calYear, calMonth, 'next');
    setCalYear(year);
    setCalMonth(month);
  }, [calYear, calMonth, navigateMonth]);

  // Seleccionar día del calendario
  const handleSelectDate = useCallback(
    (date: string) => {
      setSelectedDate(date);
      if (!isSunday(date)) {
        setModalVisible(true);
      }
    },
    []
  );

  // Guardar horas
  const handleSaveDay = useCallback(
    async (input: SaveDayInput) => {
      await saveDay(input);
    },
    [saveDay]
  );

  // Borrar día
  const handleDeleteDay = useCallback(async () => {
    if (!selectedDate) return;
    await removeDay(selectedDate);
  }, [removeDay, selectedDate]);

  const handleSubmitMonthlyReport = useCallback(() => {
    if (!monthlyReportStatus) return;
    router.push({
      pathname: '/(protected)/(tabs)/preaching',
      params: { reportMonth: monthlyReportStatus.window.targetMonthKey },
    });
  }, [monthlyReportStatus, router]);

  // ── Renderizado ──────────────────────────────────────────────────────────────

  // El contador de horas solo aplica a precursores (regulares o auxiliares)
  if (!isPioneer(appUser)) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <PageHeader title={t('fieldService.title')} showBack />
        <EmptyState
          icon="time-outline"
          title={t('fieldService.pioneersOnlyTitle')}
          description={t('fieldService.pioneersOnlyDesc')}
        />
      </SafeAreaView>
    );
  }

  if (loading) return <LoadingState message={t('common.loading')} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const visibleMonthLabel = formatMonthHeader(calYear, calMonth);
  const isCurrentMonth =
    calYear === now.getFullYear() && calMonth === now.getMonth() + 1;
  const sentAtLabel = monthlyReportStatus?.sentReport?.sentAt
    ? new Date(monthlyReportStatus.sentReport.sentAt).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* ── Header ── */}
      <PageHeader title={t('fieldService.title')} subtitle={t('fieldService.subtitle')} showBack />

      <View style={styles.deviceNotice}>
        <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
        <Text style={styles.deviceNoticeText}>{t('fieldService.deviceOnlyNotice')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Aviso de purga automática ── */}
        {purgeExecutedThisSession && (
          <View style={[styles.purgeBanner, { backgroundColor: colors.warning + '20', borderColor: colors.warning + '44' }]}>
            <Ionicons name="refresh-circle-outline" size={18} color={colors.warning} />
            <Text style={[styles.purgeText, { color: colors.warning }]}>
              {t('fieldService.purgeNotice')}
            </Text>
          </View>
        )}

        {/* ── Tarjeta de resumen del mes visible ── */}
        <View style={styles.monthCard}>
          <View style={styles.monthCardHeader}>
            <View style={[styles.monthIconWrap, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="hourglass-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.monthCardInfo}>
              <Text style={styles.monthCardLabel}>
                {isCurrentMonth ? t('fieldService.thisMonth') : visibleMonthLabel}
              </Text>
              <Text style={styles.monthCardTotal}>
                {formatMinutes(visibleMonthSummary.totalMinutes)}
              </Text>
            </View>
            <View style={styles.monthCardDays}>
              <Text style={styles.monthCardDaysNum}>
                {visibleMonthSummary.daysWithEntries}
              </Text>
              <Text style={styles.monthCardDaysLabel}>{t('fieldService.days')}</Text>
            </View>
          </View>
        </View>

        {/* ── Resumen semanal ── */}
        {weekSummary.weekStart ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t('fieldService.currentWeek')}</Text>
            <FieldServiceWeekSummary summary={weekSummary} />
          </View>
        ) : null}

        {/* ── Calendario ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('fieldService.calendar')}</Text>
          <FieldServiceCalendar
            calendar={calendar}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
          />
        </View>

        {/* ── Día seleccionado – detalle rápido ── */}
        {selectedDate && !isSunday(selectedDate) && (
          <TouchableOpacity
            style={[styles.selectedDayCard, { borderColor: colors.primary + '44', backgroundColor: colors.primary + '08' }]}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
            accessibilityLabel="Editar horas del día seleccionado"
          >
            <View style={styles.selectedDayRow}>
              <Ionicons
                name={selectedDayMinutes > 0 ? 'checkmark-circle-outline' : 'add-circle-outline'}
                size={22}
                color={selectedDayMinutes > 0 ? colors.success : colors.primary}
              />
              <View style={styles.selectedDayText}>
                <Text style={styles.selectedDayDate}>
                  {parseLocalDate(selectedDate).toLocaleDateString('es-MX', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </Text>
                <Text style={[
                  styles.selectedDayMinutes,
                  { color: selectedDayMinutes > 0 ? colors.success : colors.textMuted }
                ]}>
                  {selectedDayMinutes > 0 ? formatMinutes(selectedDayMinutes) : t('fieldService.noRecordTapToAdd')}
                </Text>
              </View>
              <Ionicons name="create-outline" size={18} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        )}

        {/* ── Nota informativa ── */}
        {monthlyReportStatus && reportMonthSummary && (
          <View style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <View style={[styles.reportIconWrap, { backgroundColor: colors.accent + '20' }]}>
                <Ionicons name="send-outline" size={18} color={colors.accent} />
              </View>
              <View style={styles.reportHeaderText}>
                <Text style={styles.reportTitle}>{t('fieldService.monthlyReport')}</Text>
                <Text style={styles.reportMonthText}>{reportMonthLabel}</Text>
              </View>
            </View>

            <Text style={styles.reportHoursText}>
              {t('fieldService.recordedHours', { hours: formatMinutes(reportMonthSummary.totalMinutes) })}
            </Text>
            {!monthlyReportStatus.alreadySent ? (
              <Text style={styles.reportStatusText}>
                {t('fieldService.reportPreparationHint')}
              </Text>
            ) : null}

            {monthlyReportStatus.alreadySent ? (
              <Text style={[styles.reportStatusText, { color: colors.success }]}>
                {sentAtLabel ? t('fieldService.reportSentOn', { date: sentAtLabel }) : t('fieldService.reportSent')}
              </Text>
            ) : monthlyReportStatus.canSubmit ? (
              <Text style={[styles.reportStatusText, { color: colors.primary }]}>
                {t('fieldService.availableUntil', { date: reportDeadlineLabel })}
              </Text>
            ) : (
              <Text style={[styles.reportStatusText, { color: colors.warning }]}>
                {t('fieldService.windowClosed', { graceDays: monthlyReportStatus.window.graceDays })}
              </Text>
            )}

            <TouchableOpacity
              style={[
                styles.reportSubmitBtn,
                {
                  backgroundColor: monthlyReportStatus.canSubmit
                    ? colors.primary
                    : colors.surfaceRaised,
                  borderColor: monthlyReportStatus.canSubmit
                    ? colors.primary
                    : colors.border,
                },
              ]}
              onPress={handleSubmitMonthlyReport}
              disabled={!monthlyReportStatus.canSubmit}
              activeOpacity={0.85}
              accessibilityLabel={t('fieldService.prepareReport', { month: reportMonthLabel })}
            >
              <Ionicons
                name="paper-plane-outline"
                size={16}
                color={monthlyReportStatus.canSubmit ? '#fff' : colors.textDisabled}
              />
              <Text
                style={[
                  styles.reportSubmitText,
                  { color: monthlyReportStatus.canSubmit ? '#fff' : colors.textDisabled },
                ]}
              >
                {monthlyReportStatus.alreadySent
                  ? t('fieldService.sent')
                  : t('fieldService.prepareReport', { month: reportMonthLabel })}
              </Text>
            </TouchableOpacity>

          </View>
        )}

        <View style={styles.infoNote}>
          <Ionicons name="information-circle-outline" size={14} color={colors.textDisabled} />
          <Text style={styles.infoNoteText}>
            {t('fieldService.infoNote')}
          </Text>
        </View>
      </ScrollView>

      {/* ── Modal de captura ── */}
      <FieldServiceDayModal
        visible={modalVisible}
        date={selectedDate}
        existingMinutes={selectedDayMinutes}
        onSave={handleSaveDay}
        onDelete={handleDeleteDay}
        onClose={() => setModalVisible(false)}
      />
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const createStyles = (colors: ReturnType<typeof useAppColors>) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.backgroundDark,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.backgroundDark,
    },
    backBtn: {
      padding: 4,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    headerSub: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 1,
    },
    headerRight: {
      width: 32,
    },
    content: {
      padding: 16,
      gap: 16,
      paddingBottom: 40,
      maxWidth: 720,
      width: '100%',
      alignSelf: 'center',
    },
    deviceNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: 720,
      width: '100%',
      alignSelf: 'center',
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    deviceNoticeText: {
      fontSize: 11,
      color: colors.textMuted,
      flex: 1,
    },
    purgeBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    purgeText: {
      fontSize: 13,
      fontWeight: '600',
      flex: 1,
    },
    monthCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    monthCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    monthIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthCardInfo: {
      flex: 1,
    },
    monthCardLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      textTransform: 'capitalize',
    },
    monthCardTotal: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.textPrimary,
      marginTop: 2,
    },
    monthCardDays: {
      alignItems: 'center',
    },
    monthCardDaysNum: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    monthCardDaysLabel: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
    },
    section: {
      gap: 10,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    selectedDayCard: {
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    selectedDayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    selectedDayText: {
      flex: 1,
    },
    selectedDayDate: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      textTransform: 'capitalize',
    },
    selectedDayMinutes: {
      fontSize: 13,
      marginTop: 2,
      fontWeight: '500',
    },
    reportCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 10,
    },
    reportHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    reportIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reportHeaderText: {
      flex: 1,
    },
    reportTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    reportMonthText: {
      fontSize: 12,
      color: colors.textMuted,
      textTransform: 'capitalize',
    },
    reportHoursText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    reportStatusText: {
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 18,
    },
    reportSubmitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderRadius: 10,
      paddingVertical: 12,
    },
    reportSubmitText: {
      fontSize: 14,
      fontWeight: '700',
    },
    reportFeedbackBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    reportFeedbackText: {
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
      lineHeight: 17,
    },
    infoNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingTop: 4,
    },
    infoNoteText: {
      flex: 1,
      fontSize: 11,
      color: colors.textDisabled,
      lineHeight: 16,
    },
  });
