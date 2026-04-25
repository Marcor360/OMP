import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { MeetingCard } from '@/src/components/cards/MeetingCard';
import { EmptyState } from '@/src/components/common/EmptyState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import { SupportedLanguage, useI18n } from '@/src/i18n/index';
import { getMeetingsByWeek } from '@/src/services/meetings/meetings-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { Meeting } from '@/src/types/meeting';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { useRefreshOnFocus } from '@/src/hooks/use-refresh-on-focus';

interface MeetingDayGroup {
  id: string;
  label: string;
  meetings: Meeting[];
}

const buildVisibleRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setMonth(end.getMonth() + 18);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const toDateValue = (meeting: Meeting): Date => {
  const source = meeting.meetingDate ?? meeting.startDate;
  if (source instanceof Date) return source;
  return source.toDate();
};

const toGroupKey = (meeting: Meeting): string => {
  const date = toDateValue(meeting);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
};

const LOCALE_BY_LANGUAGE: Record<SupportedLanguage, string> = {
  es: 'es-MX',
  en: 'en-US',
  fr: 'fr-FR',
  ar: 'ar',
  hi: 'hi-IN',
  zh: 'zh-CN',
};

const toGroupLabel = (meeting: Meeting, locale: string): string => {
  return toDateValue(meeting).toLocaleDateString(locale, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

export function MeetingsListScreen() {
  const router = useRouter();
  const { congregationId, loadingProfile, isAdminOrSupervisor } = useUser();
  const { t, language } = useI18n();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const locale = LOCALE_BY_LANGUAGE[language];

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadingRef = React.useRef(false);

  const loadMeetings = useCallback(
    async (forceServer = false) => {
      // Evitar llamadas concurrentes (protecciÃ³n contra re-entrancia)
      if (loadingRef.current) return;
      loadingRef.current = true;

      if (!congregationId) {
        setMeetings([]);
        setError(t('meetings.list.noCongregation'));
        setLoading(false);
        setRefreshing(false);
        loadingRef.current = false;
        return;
      }

      if (!forceServer) setLoading(true);
      setError(null);

      try {
        const { start, end } = buildVisibleRange();

        const docs = await getMeetingsByWeek(congregationId, start, end, {
          forceServer,
          includeMidweek: true,
          publicationStatus: 'published',
          maxItems: 120,
        });

        setMeetings(docs);
      } catch (requestError) {
        setMeetings([]);
        setError(formatFirestoreError(requestError));
      } finally {
        setLoading(false);
        setRefreshing(false);
        loadingRef.current = false;
      }
    },
    [congregationId, t]
  );

  useEffect(() => {
    void loadMeetings(true);
  }, [loadMeetings]);

  // Refresca cuando el usuario regresa a esta tab o la app vuelve al primer plano.
  const handleFocusRefresh = useCallback(() => {
    void loadMeetings(true);
  }, [loadMeetings]);

  useRefreshOnFocus(handleFocusRefresh, true, {
    refreshOnAppActive: false,
    skipInitialFocus: false,
  });

  const groupedMeetings = useMemo<MeetingDayGroup[]>(() => {
    const byDate = new Map<string, MeetingDayGroup>();

    meetings.forEach((meeting) => {
      const key = toGroupKey(meeting);
      const current = byDate.get(key);

      if (!current) {
        byDate.set(key, {
          id: key,
          label: toGroupLabel(meeting, locale),
          meetings: [meeting],
        });
        return;
      }

      current.meetings.push(meeting);
    });

    return Array.from(byDate.values()).sort((left, right) => left.id.localeCompare(right.id));
  }, [locale, meetings]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMeetings(true);
  };

  if (loading || loadingProfile) return <LoadingState message={t('meetings.list.loading')} />;
  if (error) return <ErrorState message={error} onRetry={onRefresh} />;

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <FlatList
        data={groupedMeetings}
        keyExtractor={(group) => group.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListHeaderComponent={
          <>
            <View style={styles.headerRow}>
              <ThemedText style={styles.headerCount}>
                {meetings.length} {t('meetings.list.publishedCount')}
              </ThemedText>
              <View style={styles.headerActions}>
                {isAdminOrSupervisor ? (
                  <TouchableOpacity style={styles.manageButton} onPress={() => router.push('/(protected)/meetings/manage')}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
                    <ThemedText style={styles.manageButtonText}>
                      {t('meetings.list.manage')}
                    </ThemedText>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </>
        }
        renderItem={({ item: group }) => {
          const collapsed = collapsedGroups[group.id] === true;

          return (
            <View style={styles.groupWrap}>
              <TouchableOpacity
                style={styles.groupHeader}
                onPress={() =>
                  setCollapsedGroups((current) => ({
                    ...current,
                    [group.id]: !current[group.id],
                  }))
                }
                activeOpacity={0.8}
              >
                <ThemedText style={styles.groupTitle}>{group.label}</ThemedText>
                <View style={styles.groupRight}>
                  <ThemedText style={styles.groupCount}>{group.meetings.length}</ThemedText>
                  <Ionicons
                    name={collapsed ? 'chevron-down-outline' : 'chevron-up-outline'}
                    size={16}
                    color={colors.textMuted}
                  />
                </View>
              </TouchableOpacity>

              {!collapsed ? (
                <View style={styles.cardsWrap}>
                  {group.meetings.map((meeting) => (
                    <MeetingCard key={meeting.id} meeting={meeting} />
                  ))}
                </View>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="calendar-outline"
              title={t('meetings.list.empty.title')}
              description={t('meetings.list.empty.description')}
            />
          </View>
        }
      />
    </ScreenContainer>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    listContent: { paddingBottom: 28, paddingHorizontal: 14, gap: 10 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, paddingBottom: 10 },
    headerCount: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
    headerActions: { flexDirection: 'row', gap: 8 },
    manageButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.primary + '66', backgroundColor: colors.primary + '12', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
    manageButtonText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
    groupWrap: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface },
    groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.backgroundLight },
    groupTitle: { fontSize: 14, fontWeight: '800', color: colors.textSecondary, flex: 1, textTransform: 'capitalize' },
    groupRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    groupCount: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
    cardsWrap: { padding: 10, gap: 8 },
    emptyWrap: { paddingTop: 18 },
  });

