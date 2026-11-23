import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, ScrollView, View } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import { useI18n } from '@/src/i18n/index';
import { getMeetingWorkReview, type MeetingReviewKind, type MeetingWorkReview } from '@/src/services/meetings/meeting-work-review-service';
import { formatFirestoreError } from '@/src/utils/errors/errors';

const assignmentStatusLabels = {
  pending: 'meetings.workReview.status.pending',
  assigned: 'meetings.workReview.status.assigned',
  in_progress: 'meetings.workReview.status.inProgress',
  completed: 'meetings.workReview.status.completed',
  overdue: 'meetings.workReview.status.overdue',
} as const;

export function MeetingWorkReviewPanel({ congregationId, meetingId, canReviewAssignments, conflictCount, initialReview }: {
  congregationId: string;
  meetingId: string;
  canReviewAssignments: boolean;
  conflictCount: number;
  initialReview?: MeetingReviewKind;
}) {
  const { t, formatDateTime } = useI18n();
  const router = useRouter();
  const [selection, setSelection] = useState<{ kind: MeetingReviewKind; conflictCount: number }>();
  const review = selection?.conflictCount === conflictCount ? selection.kind : conflictCount ? 'history' : initialReview;
  const [refresh, setRefresh] = useState(0);
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [result, setResult] = useState<{ key: string; data?: MeetingWorkReview; error?: string }>();
  const key = JSON.stringify([review, refresh, conflictCount]);
  const current = result?.key === key ? result : undefined;
  const duplicateGroups = current?.data?.duplicates ?? [];
  const dates = Array.from(new Set(duplicateGroups.flatMap((group) => group.map((item) => item.day)))).sort();
  const statusOptions = Object.entries(assignmentStatusLabels).filter(([value]) =>
    duplicateGroups.some((group) => group.some((item) => item.status === value))
  );
  const visibleGroups = duplicateGroups.filter((group) => group.some((item) =>
    (!dateFilter || item.day === dateFilter) && (!statusFilter || item.status === statusFilter)
  ));

  useFocusEffect(useCallback(() => {
    if (!review) return;
    let currentRequest = true;
    void getMeetingWorkReview(congregationId, meetingId, review).then(
      (data) => { if (currentRequest) setResult({ key, data }); },
      (error: unknown) => { if (currentRequest) setResult({ key, error: formatFirestoreError(error) }); },
    );
    return () => { currentRequest = false; };
  }, [congregationId, meetingId, review, key]));

  const select = (kind: MeetingReviewKind) => {
    setSelection({ kind, conflictCount });
    setRefresh((value) => value + 1);
  };

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button title={t('meetings.workReview.history')} onPress={() => select('history')} />
        {canReviewAssignments ? <Button title={t('meetings.workReview.duplicates')} onPress={() => select('duplicates')} /> : null}
      </View>
      {review && !current ? <ThemedText>{t('meetings.workReview.loading')}</ThemedText> : null}
      {current?.error ? <ThemedText accessibilityRole="alert">{current.error}</ThemedText> : null}
      {review === 'history' && current?.data ? (
        <View style={{ gap: 8 }}>
          <ThemedText type="defaultSemiBold">{t('meetings.workReview.history')}</ThemedText>
          {current.data.history.length === 0 ? <ThemedText>{t('meetings.workReview.noHistory')}</ThemedText> : null}
          {current.data.history.map((entry) => (
            <View key={entry.id} style={{ gap: 4 }}>
              <ThemedText type="defaultSemiBold">
                {formatDateTime(entry.createdAt)} · {t(entry.ownChange ? 'meetings.workReview.ownChange' : 'meetings.workReview.otherEditor')}
              </ThemedText>
              {entry.changedSections.map((section) => (
                <ThemedText key={section.key}>{section.title} · {t(`meetings.workReview.${section.change}`)}</ThemedText>
              ))}
              {entry.detailsChanged ? <ThemedText>{t('meetings.workReview.detailsChanged')}</ThemedText> : null}
              {entry.publicationChanged ? <ThemedText>{t('meetings.workReview.publicationChanged')}</ThemedText> : null}
              {entry.sectionsTruncated ? <ThemedText>{t('meetings.workReview.sectionsTruncated')}</ThemedText> : null}
            </View>
          ))}
        </View>
      ) : null}
      {review === 'duplicates' && current?.data ? (
        <View style={{ gap: 8 }}>
          <ThemedText type="defaultSemiBold">{t('meetings.workReview.duplicates')}</ThemedText>
          <ThemedText>{t('meetings.workReview.scanScope', { count: current.data.assignmentsReviewed ?? 0 })}</ThemedText>
          {current.data.assignmentsTruncated ? <ThemedText>{t('meetings.workReview.assignmentsTruncated')}</ThemedText> : null}
          {duplicateGroups.length ? (
            <>
              <ThemedText>{t('meetings.workReview.filterDay')}</ThemedText>
              <ScrollView horizontal keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
                <Button title={t('meetings.workReview.allDays')} disabled={!dateFilter} onPress={() => setDateFilter('')} />
                {dates.map((day) => <Button key={day} title={day} disabled={dateFilter === day} onPress={() => setDateFilter(day)} />)}
              </ScrollView>
              <ThemedText>{t('meetings.workReview.filterStatus')}</ThemedText>
              <ScrollView horizontal keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
                <Button title={t('meetings.workReview.allStatuses')} disabled={!statusFilter} onPress={() => setStatusFilter('')} />
                {statusOptions.map(([value, label]) => <Button key={value} title={t(label)} disabled={statusFilter === value} onPress={() => setStatusFilter(value)} />)}
              </ScrollView>
            </>
          ) : null}
          {visibleGroups.length === 0 ? <ThemedText>{t('meetings.workReview.noDuplicates')}</ThemedText> : null}
          {visibleGroups.map((group) => (
            <View key={group[0].id} style={{ gap: 8, paddingVertical: 6 }}>
              {group.map((assignment) => {
                const status = Object.prototype.hasOwnProperty.call(assignmentStatusLabels, assignment.status)
                  ? assignmentStatusLabels[assignment.status as keyof typeof assignmentStatusLabels]
                  : undefined;
                return (
                  <View key={assignment.id} style={{ gap: 4 }}>
                    <ThemedText>{assignment.title} · {assignment.day}{assignment.target ? ` · ${assignment.target}` : ''}</ThemedText>
                    {status ? <ThemedText>{t(status)}</ThemedText> : null}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <Button title={t('meetings.management.row.view')} onPress={() => router.push(
                        `/(protected)/assignments/${encodeURIComponent(assignment.id)}?source=meeting&meetingId=${encodeURIComponent(meetingId)}` as never
                      )} />
                      <Button title={t('common.edit')} onPress={() => router.push(
                        `/(protected)/assignments/edit/${encodeURIComponent(assignment.id)}?meetingId=${encodeURIComponent(meetingId)}` as never
                      )} />
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
