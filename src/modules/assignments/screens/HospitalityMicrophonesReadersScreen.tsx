import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { EmptyState } from '@/src/components/common/EmptyState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import { useI18n } from '@/src/i18n';
import {
  getCurrentPublishedHospitalitySchedule,
  getHospitalityScheduleItems,
} from '@/src/services/hospitality-microphones/hospitality-microphones-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import type { HospitalityScheduleItem } from '@/src/types/hospitality-microphones';
import { parseDateKey } from '@/src/utils/dates/date-key';
import { getWeekRangeForDate } from '@/src/utils/dates/week-range';
import { formatFirestoreError } from '@/src/utils/errors/errors';

type MeetingGroup = {
  key: string;
  date: string;
  type: 'midweek' | 'weekend';
  items: HospitalityScheduleItem[];
};

type WeekGroup = { key: string; label: string; meetings: MeetingGroup[] };

const ROLE_ORDER: HospitalityScheduleItem['roleKey'][] = [
  'chairman',
  'microphoneOne',
  'microphoneTwo',
  'microphoneThree',
  'attendantDoor',
  'attendantAuditorium',
  'attendantExtra',
  'watchtowerReader',
  'midweekBibleStudyReader',
  'audioVideo',
];

const compactDate = (dateKey: string, locale: string): string => {
  const date = parseDateKey(dateKey);
  if (!date) return dateKey;
  const value = date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const weekLabel = (dateKey: string, locale: string): string => {
  const { weekStartDate, weekEndDate } = getWeekRangeForDate(dateKey);
  const start = parseDateKey(weekStartDate);
  const end = parseDateKey(weekEndDate);
  if (!start || !end) return dateKey;
  const startMonth = start.toLocaleDateString(locale, { month: 'short' }).replace('.', '');
  const endMonth = end.toLocaleDateString(locale, { month: 'short' }).replace('.', '');
  return startMonth === endMonth
    ? `${start.getDate()}–${end.getDate()} ${endMonth}`
    : `${start.getDate()} ${startMonth}–${end.getDate()} ${endMonth}`;
};

const groupItems = (items: HospitalityScheduleItem[], locale: string): WeekGroup[] => {
  const meetings = new Map<string, MeetingGroup>();
  items.filter((item) => item.status === 'scheduled').forEach((item) => {
    const key = `${item.meetingDate}:${item.meetingType}`;
    const current = meetings.get(key) ?? { key, date: item.meetingDate, type: item.meetingType, items: [] };
    current.items.push(item);
    meetings.set(key, current);
  });
  const weeks = new Map<string, MeetingGroup[]>();
  Array.from(meetings.values()).sort((left, right) => left.date.localeCompare(right.date)).forEach((meeting) => {
    const key = getWeekRangeForDate(meeting.date).weekStartDate;
    weeks.set(key, [...(weeks.get(key) ?? []), meeting]);
  });
  return Array.from(weeks.entries()).map(([key, groupedMeetings]) => ({
    key,
    label: weekLabel(key, locale),
    meetings: groupedMeetings.map((meeting) => ({
      ...meeting,
      items: [...meeting.items].sort(
        (left, right) => ROLE_ORDER.indexOf(left.roleKey) - ROLE_ORDER.indexOf(right.roleKey)
      ),
    })),
  }));
};

export function HospitalityMicrophonesReadersScreen() {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { width } = useWindowDimensions();
  const { congregationId, uid, loadingProfile, profileError } = useUser();
  const { language, t } = useI18n();
  const [items, setItems] = useState<HospitalityScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!congregationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const schedule = await getCurrentPublishedHospitalitySchedule(congregationId);
      setItems(schedule ? await getHospitalityScheduleItems({ congregationId, scheduleId: schedule.id }) : []);
    } catch (requestError) {
      setError(formatFirestoreError(requestError));
    } finally {
      setLoading(false);
    }
  }, [congregationId]);

  useEffect(() => { void load(); }, [load]);

  const weeks = useMemo(() => groupItems(items, language), [items, language]);
  const myAssignments = useMemo(
    () => items.filter((item) => item.status === 'scheduled' && item.userId === uid).sort((left, right) => left.meetingDate.localeCompare(right.meetingDate)),
    [items, uid]
  );

  if (loadingProfile || loading) return <LoadingState message={t('hospitality.readersLoading')} />;
  if (!congregationId) return <ErrorState message={profileError ?? t('dashboard.noCongregation')} />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <PageHeader title={t('hospitality.readersTitle')} subtitle={t('hospitality.readersSubtitle')} showBack />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {items.length === 0 ? (
            <EmptyState icon="calendar-clear-outline" title={t('hospitality.publishedEmpty')} />
          ) : (
            <>
              {myAssignments.length > 0 ? (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
                    <ThemedText style={styles.sectionTitle}>{t('hospitality.myAssignments')}</ThemedText>
                  </View>
                  <View style={styles.myGrid}>
                    {myAssignments.map((item) => (
                      <View key={item.id} style={styles.myCard}>
                        <ThemedText style={styles.myRole}>{item.roleLabel}</ThemedText>
                        <ThemedText style={styles.myDate}>{compactDate(item.meetingDate, language)}</ThemedText>
                        <ThemedText style={styles.myType}>{item.meetingType === 'midweek' ? t('hospitality.scheduleMidweek') : t('hospitality.scheduleWeekend')}</ThemedText>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle}>{t('hospitality.fullPublishedList')}</ThemedText>
                <View style={[styles.weekGrid, width >= 760 && styles.weekGridDesktop]}>
                  {weeks.map((week) => (
                    <View key={week.key} style={[styles.weekCard, width >= 760 && styles.weekCardDesktop]}>
                      <View style={styles.weekHeader}>
                        <ThemedText style={styles.weekTitle}>{week.label}</ThemedText>
                      </View>
                      {week.meetings.map((meeting) => (
                        <View key={meeting.key} style={styles.meeting}>
                          <View style={styles.meetingHeader}>
                            <ThemedText style={styles.meetingDate}>{compactDate(meeting.date, language)}</ThemedText>
                            <ThemedText style={styles.meetingType}>{meeting.type === 'midweek' ? t('hospitality.scheduleMidweek') : t('hospitality.scheduleWeekend')}</ThemedText>
                          </View>
                          <View style={styles.rolePairs}>
                            {meeting.items.map((item) => (
                              <View key={item.id} style={styles.rolePair}>
                                <ThemedText style={styles.roleLabel}>{item.roleLabel}</ThemedText>
                                <ThemedText style={styles.roleName} numberOfLines={1}>{item.userNameSnapshot}</ThemedText>
                              </View>
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const createStyles = (colors: AppColorSet) => StyleSheet.create({
  scrollContent: { padding: 16, paddingBottom: 32 },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', gap: 22 },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '900' },
  myGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  myCard: { flexGrow: 1, minWidth: 180, borderWidth: 1, borderColor: `${colors.primary}55`, borderRadius: 12, padding: 12, backgroundColor: `${colors.primary}0B`, gap: 3 },
  myRole: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  myDate: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  myType: { color: colors.textMuted, fontSize: 11 },
  weekGrid: { gap: 12 },
  weekGridDesktop: { flexDirection: 'row', flexWrap: 'wrap' },
  weekCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface, overflow: 'hidden' },
  weekCardDesktop: { width: '48.8%' },
  weekHeader: { paddingHorizontal: 12, paddingVertical: 9, backgroundColor: `${colors.primary}12`, borderBottomWidth: 1, borderBottomColor: colors.border },
  weekTitle: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  meeting: { padding: 12, gap: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  meetingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  meetingDate: { color: colors.textPrimary, fontSize: 13, fontWeight: '800' },
  meetingType: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  rolePairs: { gap: 6 },
  rolePair: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  roleLabel: { width: '44%', color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  roleName: { flex: 1, color: colors.textPrimary, fontSize: 11, fontWeight: '700' },
});
