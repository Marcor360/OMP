import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { MeetingCard } from '@/src/components/cards/MeetingCard';
import { EmptyState } from '@/src/components/common/EmptyState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useMeetingsManagementPermission } from '@/src/hooks/use-meetings-management-permission';
import { useI18n } from '@/src/i18n/index';
import { setMeetingPublicationStatus } from '@/src/services/meetings/meeting-publish-service';
import { deleteMeeting, getAllMeetings } from '@/src/services/meetings/meetings-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { Meeting } from '@/src/types/meeting';
import { MeetingPublicationStatus } from '@/src/types/meeting/program';
import { formatFirestoreError } from '@/src/utils/errors/errors';

const PUBLICATION_FILTERS: (MeetingPublicationStatus | 'all')[] = [
  'all',
  'draft',
  'published',
];

export function MeetingsManagementScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { canManage, congregationId, loading: loadingPermission } = useMeetingsManagementPermission();
  const colors = useAppColors();
  const styles = createStyles(colors);

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [publicationFilter, setPublicationFilter] = useState<MeetingPublicationStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingMeetingId, setDeletingMeetingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMeetings = useCallback(
    async (forceServer = false) => {
      if (!congregationId) {
        setMeetings([]);
        setError(t('meetings.management.noCongregation'));
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (!forceServer) setLoading(true);
      setError(null);

      try {
        const docs = await getAllMeetings(congregationId);
        setMeetings(docs);
      } catch (requestError) {
        setMeetings([]);
        setError(formatFirestoreError(requestError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [congregationId, t]
  );

  const filteredMeetings = useMemo(() => {
    if (publicationFilter === 'all') {
      return meetings;
    }

    return meetings.filter((meeting) => meeting.publicationStatus === publicationFilter);
  }, [meetings, publicationFilter]);

  useEffect(() => {
    if (!canManage) return;
    void loadMeetings(false);
  }, [canManage, loadMeetings]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMeetings(true);
  };

  const togglePublication = async (meeting: Meeting) => {
    if (!congregationId) return;

    const nextStatus: MeetingPublicationStatus =
      meeting.publicationStatus === 'published' ? 'draft' : 'published';

    try {
      const result = await setMeetingPublicationStatus({
        congregationId,
        meetingId: meeting.id,
        publicationStatus: nextStatus,
      });

      if (!result.ok) {
        Alert.alert(t('meetings.management.alert.validation'), result.errors.join('\n'));
        return;
      }

      Alert.alert(
        t('meetings.management.alert.success'),
        nextStatus === 'published'
          ? t('meetings.management.alert.published')
          : t('meetings.management.alert.sentToDraft')
      );
      await onRefresh();
    } catch (requestError) {
      Alert.alert(t('common.error'), formatFirestoreError(requestError));
    }
  };

  const deleteMeetingWithConfirmation = (meeting: Meeting) => {
    if (!congregationId || deletingMeetingId) return;

    Alert.alert(
      t('meetings.management.alert.deleteTitle'),
      t('meetings.management.alert.deleteMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            void executeDeleteMeeting(meeting);
          },
        },
      ]
    );
  };

  const executeDeleteMeeting = async (meeting: Meeting) => {
    if (!congregationId) return;

    setDeletingMeetingId(meeting.id);

    try {
      await deleteMeeting(congregationId, meeting.id);
      setMeetings((current) => current.filter((item) => item.id !== meeting.id));
      Alert.alert(t('meetings.management.alert.success'), t('meetings.management.alert.deleted'));
    } catch (requestError) {
      Alert.alert(t('common.error'), formatFirestoreError(requestError));
    } finally {
      setDeletingMeetingId(null);
    }
  };

  if (loading || loadingPermission) return <LoadingState message={t('meetings.management.loading')} />;
  if (error) return <ErrorState message={error} onRetry={onRefresh} />;

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <FlatList
        data={filteredMeetings}
        keyExtractor={(meeting) => meeting.id}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={onRefresh}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <PageHeader
              title={t('meetings.management.title')}
              subtitle={t('meetings.management.subtitle')}
              showBack
            />

            <View style={styles.actionBar}>
              <TouchableOpacity style={styles.createButton} onPress={() => router.push('/(protected)/meetings/create?type=weekend' as never)}>
                <Ionicons name="add-outline" size={16} color={colors.onPrimary} />
                <ThemedText style={styles.createButtonText}>
                  {t('meetings.management.action.newWeekend')}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createButton} onPress={() => router.push('/(protected)/meetings/create?type=midweek' as never)}>
                <Ionicons name="add-outline" size={16} color={colors.onPrimary} />
                <ThemedText style={styles.createButtonText}>
                  {t('meetings.management.action.newMidweek')}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/(protected)/meetings/midweek' as never)}>
                <Ionicons name="document-attach-outline" size={16} color={colors.infoDark} />
                <ThemedText style={styles.secondaryButtonText}>
                  {t('meetings.management.action.importMidweekPdf')}
                </ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.filtersRow}>
              {PUBLICATION_FILTERS.map((filterOption) => (
                <TouchableOpacity
                  key={filterOption}
                  style={[styles.filterChip, publicationFilter === filterOption && styles.filterChipActive]}
                  onPress={() => setPublicationFilter(filterOption)}
                >
                  <ThemedText style={[styles.filterChipText, publicationFilter === filterOption && styles.filterChipTextActive]}>
                    {filterOption === 'all'
                      ? t('meetings.management.filter.all')
                      : filterOption === 'draft'
                        ? t('meetings.management.filter.draft')
                        : t('meetings.management.filter.published')}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.meetingWrap}>
            <MeetingCard meeting={item} />
            <View style={styles.meetingActions}>
              <TouchableOpacity style={styles.smallAction} onPress={() => router.push(`/(protected)/meetings/${item.id}` as never)}>
                <Ionicons name="eye-outline" size={15} color={colors.textPrimary} />
                <ThemedText style={styles.smallActionText}>
                  {t('meetings.management.row.view')}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.smallAction} onPress={() => router.push(`/(protected)/meetings/edit/${item.id}` as never)}>
                <Ionicons name="pencil-outline" size={15} color={colors.textPrimary} />
                <ThemedText style={styles.smallActionText}>
                  {t('meetings.management.row.edit')}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.publishAction} onPress={() => void togglePublication(item)}>
                <Ionicons name={item.publicationStatus === 'published' ? 'close-circle-outline' : 'send-outline'} size={15} color={item.publicationStatus === 'published' ? colors.error : colors.successDark} />
                <ThemedText style={[styles.publishActionText, { color: item.publicationStatus === 'published' ? colors.error : colors.successDark }]}>
                  {item.publicationStatus === 'published'
                    ? t('meetings.management.row.unpublish')
                    : t('meetings.management.row.publish')}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteAction, deletingMeetingId === item.id && styles.actionDisabled]}
                onPress={() => deleteMeetingWithConfirmation(item)}
                disabled={Boolean(deletingMeetingId)}
              >
                <Ionicons
                  name={deletingMeetingId === item.id ? 'hourglass-outline' : 'trash-outline'}
                  size={15}
                  color={colors.error}
                />
                <ThemedText style={styles.deleteActionText}>
                  {t('meetings.management.row.delete')}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="calendar-outline"
              title={t('meetings.management.empty.title')}
              description={t('meetings.management.empty.description')}
            />
          </View>
        }
      />
    </ScreenContainer>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    listContent: { paddingHorizontal: 14, paddingBottom: 28, gap: 10 },
    actionBar: { gap: 8, marginBottom: 10 },
    createButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
    createButtonText: { color: colors.onPrimary, fontWeight: '800', fontSize: 13 },
    secondaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.info + '66', backgroundColor: colors.infoLight, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
    secondaryButtonText: { color: colors.infoDark, fontWeight: '700', fontSize: 13 },
    filtersRow: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
    filterChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.surface },
    filterChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
    filterChipText: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
    filterChipTextActive: { color: colors.onPrimary },
    meetingWrap: { gap: 8 },
    meetingActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
    smallAction: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.surface },
    smallActionText: { fontSize: 12, color: colors.textPrimary, fontWeight: '700' },
    publishAction: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.surface },
    publishActionText: { fontSize: 12, fontWeight: '800' },
    deleteAction: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.error + '55', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.error + '10' },
    deleteActionText: { fontSize: 12, fontWeight: '800', color: colors.error },
    actionDisabled: { opacity: 0.55 },
    emptyWrap: { paddingTop: 18 },
  });
