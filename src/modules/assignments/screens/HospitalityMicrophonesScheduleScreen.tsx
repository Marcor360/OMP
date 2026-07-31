import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { EmptyState } from '@/src/components/common/EmptyState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { HospitalityMeetingCard } from '@/src/modules/assignments/components/HospitalityMeetingCard';
import { HospitalityRoleGrid } from '@/src/modules/assignments/components/HospitalityRoleGrid';
import { HospitalityScheduleFooter } from '@/src/modules/assignments/components/HospitalityScheduleFooter';
import { HospitalityScheduleSetup } from '@/src/modules/assignments/components/HospitalityScheduleSetup';
import { UserPickerModal } from '@/src/modules/assignments/components/UserPickerModal';
import { useHospitalityScheduleBuilder } from '@/src/modules/assignments/hooks/useHospitalityScheduleBuilder';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

export function HospitalityMicrophonesScheduleScreen() {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null);
  const builder = useHospitalityScheduleBuilder();
  const { auth, state, setup, progress, picker, actions, helpers, t } = builder;
  const busy = state.saving || state.publishing || state.generatingMeetings || state.substituting;

  if (auth.loadingProfile || state.loading) {
    return <LoadingState message={t('hospitality.scheduleLoading')} />;
  }
  if (!auth.congregationId) {
    return <ErrorState message={auth.profileError ?? t('dashboard.noCongregation')} />;
  }
  if (!auth.canManage) {
    return <ErrorState message={t('hospitality.scheduleNoPermission')} />;
  }
  if (state.error) {
    return <ErrorState message={state.error} onRetry={() => void actions.reload()} />;
  }

  const roleLabel = (roleKey: Parameters<typeof helpers.cellConflict>[1]) =>
    t(`hospitality.roles.${roleKey}`);

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <PageHeader title={t('hospitality.scheduleTitle')} subtitle={t('hospitality.scheduleSubtitle')} showBack />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <HospitalityScheduleSetup
            title={setup.title}
            startDate={setup.startDate}
            endDate={setup.endDate}
            midweekDay={setup.midweekDay}
            weekendDay={setup.weekendDay}
            optionalRoles={setup.optionalRoles}
            schedules={builder.schedules}
            selectedScheduleId={builder.selectedSchedule?.id}
            busy={busy}
            generating={state.generatingMeetings}
            labels={{
              workList: t('hospitality.scheduleWorkList'),
              titlePlaceholder: t('hospitality.scheduleTitlePlaceholder'),
              microphoneThree: t('hospitality.scheduleUseMicrophoneThree'),
              attendantExtra: t('hospitality.scheduleUseAttendantExtra'),
              midweekDay: t('hospitality.scheduleMidweekDay'),
              weekendDay: t('hospitality.scheduleWeekendDay'),
              generate: t('hospitality.scheduleGenerateMeetings'),
              generating: t('hospitality.scheduleGeneratingMeetings'),
              load: t('hospitality.scheduleLoadMeetings'),
              published: t('hospitality.scheduleStatusPublished'),
              draft: t('hospitality.scheduleStatusDraft'),
            }}
            weekdayLabel={(weekday) => t(`hospitality.weekdays.${weekday}`)}
            onTitleChange={setup.setTitle}
            onStartDateChange={setup.setStartDate}
            onEndDateChange={setup.setEndDate}
            onMidweekDayChange={setup.setMidweekDay}
            onWeekendDayChange={setup.setWeekendDay}
            onOptionalRolesChange={setup.setOptionalRoles}
            onGenerate={actions.generateMeetings}
            onLoad={() => void actions.loadRows()}
            onOpenSchedule={(schedule) => void actions.openSchedule(schedule)}
          />

          {builder.rows.length === 0 ? (
            <EmptyState icon="calendar-clear-outline" title={t('hospitality.scheduleEmptyTitle')} description={t('hospitality.scheduleEmptyDesc')} />
          ) : isDesktop ? (
            <HospitalityRoleGrid
              weeks={builder.weekGroups}
              optionalRoles={setup.optionalRoles}
              usersById={builder.usersById}
              published={state.isPublishedView}
              disabled={busy}
              dateColumnLabel={t('hospitality.gridMeeting')}
              readerLabel={t('hospitality.gridReader')}
              unassignedLabel={t('hospitality.scheduleUnassigned')}
              awaitingLabel={t('hospitality.awaitingAssignment')}
              formatDate={helpers.compactDate}
              roleLabel={roleLabel}
              conflictFor={helpers.cellConflict}
              onSelectRole={picker.open}
            />
          ) : (
            <View style={styles.cards}>
              {builder.weekGroups.map((week) => (
                <View key={week.key} style={styles.weekBlock}>
                  <View style={styles.weekSeparator}>
                    <PageHeaderText value={week.label} color={colors.primary} />
                  </View>
                  {week.rows.map((row) => (
                    <HospitalityMeetingCard
                      key={row.meetingId}
                      row={row}
                      optionalRoles={setup.optionalRoles}
                      usersById={builder.usersById}
                      expanded={expandedMeetingId === row.meetingId}
                      published={state.isPublishedView}
                      disabled={busy}
                      midweekLabel={t('hospitality.scheduleMidweek')}
                      weekendLabel={t('hospitality.scheduleWeekend')}
                      unassignedLabel={t('hospitality.scheduleUnassigned')}
                      awaitingLabel={t('hospitality.awaitingAssignment')}
                      substituteLabel={t('hospitality.substitute')}
                      formatDate={helpers.compactDate}
                      roleLabel={roleLabel}
                      conflictFor={helpers.cellConflict}
                      onToggle={() => setExpandedMeetingId((current) => current === row.meetingId ? null : row.meetingId)}
                      onSelectRole={picker.open}
                    />
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <HospitalityScheduleFooter
        complete={progress.completeMeetings}
        total={progress.totalMeetings}
        missing={progress.missingAssignments}
        busy={busy}
        saving={state.saving}
        publishing={state.publishing}
        published={state.isPublishedView}
        canPublish={progress.canPublish}
        labels={{
          summary: t('hospitality.completeMeetingSummary', { complete: progress.completeMeetings, total: progress.totalMeetings }),
          missing: t('hospitality.publishMissingReason', { count: progress.missingAssignments }),
          save: t('hospitality.scheduleSave'),
          saving: t('hospitality.scheduleSaving'),
          publish: t('hospitality.schedulePublish'),
          publishing: t('hospitality.schedulePublishing'),
        }}
        onSave={actions.save}
        onPublish={actions.publish}
      />

      <UserPickerModal
        visible={picker.visible}
        title={picker.roleKey ? roleLabel(picker.roleKey) : t('hospitality.selectUser')}
        subtitle={picker.row ? helpers.compactDate(picker.row.meetingDate) : undefined}
        users={builder.users}
        selectedUserId={picker.selectedUserId}
        disabledReasons={picker.disabledReasons}
        allowClear={!state.isPublishedView}
        clearLabel={t('hospitality.scheduleUnassigned')}
        searchPlaceholder={t('hospitality.searchUser')}
        closeLabel={t('common.close')}
        availableLabel={t('hospitality.userAvailable')}
        selectedLabel={t('hospitality.userSelected')}
        onClose={picker.close}
        onSelect={picker.select}
      />
    </ScreenContainer>
  );
}

function PageHeaderText({ value, color }: { value: string; color: string }) {
  return <ThemedText style={{ color, fontSize: 12, fontWeight: '900' }}>{value}</ThemedText>;
}

const createStyles = (colors: AppColorSet) => StyleSheet.create({
  scrollContent: { padding: 16, paddingBottom: 24 },
  content: { width: '100%', maxWidth: 1200, alignSelf: 'center', gap: 14 },
  cards: { gap: 14 },
  weekBlock: { gap: 8 },
  weekSeparator: { paddingHorizontal: 4, paddingTop: 4, borderBottomWidth: 1, borderBottomColor: `${colors.primary}44`, paddingBottom: 6 },
});
