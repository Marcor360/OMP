import { useEffect, useState } from 'react';
import { Button, View } from 'react-native';

import { ErrorState } from '@/src/components/common/ErrorState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { MeetingWorkReviewPanel } from '@/src/components/meetings/MeetingWorkReviewPanel';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import { useI18n } from '@/src/i18n/index';
import { getMeetingsByWeek } from '@/src/services/meetings/meetings-service';
import { timestampToDate } from '@/src/services/meetings/meeting.mapper';
import type { Meeting } from '@/src/types/meeting';
import { getOperationalWindow } from '@/src/utils/dates/operational-window';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { canManageAssignments } from '@/src/utils/permissions/permissions';

export function AssignmentReviewScreen() {
  const { appUser, uid, congregationId } = useUser();
  const { t, formatDate } = useI18n();
  const canReview = canManageAssignments(appUser);
  const scope = JSON.stringify([uid, congregationId]);
  const [result, setResult] = useState<{ scope: string; meetings?: Meeting[]; error?: string }>();
  const [selection, setSelection] = useState<{ scope: string; meetingId: string }>();
  const current = result?.scope === scope ? result : undefined;
  const selected = selection?.scope === scope ? current?.meetings?.find(({ id }) => id === selection.meetingId) : undefined;

  useEffect(() => {
    if (!canReview || !congregationId) return;
    let active = true;
    const { start, end } = getOperationalWindow();
    void getMeetingsByWeek(congregationId, start, end, { includeMidweek: true, maxItems: 60, publicationStatus: 'all' })
      .then(
        (meetings) => { if (active) setResult({ scope, meetings }); },
        (error: unknown) => { if (active) setResult({ scope, error: formatFirestoreError(error) }); },
      );
    return () => { active = false; };
  }, [canReview, congregationId, scope]);

  if (!canReview || !congregationId) {
    return <ErrorState message={t('assignments.pendingSaves.denied')} />;
  }

  return (
    <ScreenContainer contentStyle={{ gap: 12 }}>
      <PageHeader title={t('meetings.workReview.duplicates')} showBack />
      {current?.error ? <ErrorState message={current.error} /> : null}
      {!current ? <ThemedText>{t('meetings.workReview.loading')}</ThemedText> : null}
      {!selected && current?.meetings?.length === 0 ? <ThemedText>{t('assignments.noReadyMeetingsTitle')}</ThemedText> : null}
      {selected ? (
        <>
          <ThemedText type="defaultSemiBold">{selected.title}</ThemedText>
          <Button title={t('meetings.workReview.selectMeeting')} onPress={() => setSelection(undefined)} />
          <MeetingWorkReviewPanel
            key={JSON.stringify([scope, selected.id])}
            congregationId={congregationId}
            meetingId={selected.id}
            canReviewAssignments
            conflictCount={0}
            initialReview="duplicates"
          />
        </>
      ) : (
        <View style={{ gap: 8 }}>
          {current?.meetings?.map((meeting) => {
            const date = timestampToDate(meeting.meetingDate ?? meeting.startDate);
            return <Button key={meeting.id} title={date ? `${formatDate(date)} · ${meeting.title}` : meeting.title}
              onPress={() => setSelection({ scope, meetingId: meeting.id })}
            />;
          })}
        </View>
      )}
    </ScreenContainer>
  );
}
