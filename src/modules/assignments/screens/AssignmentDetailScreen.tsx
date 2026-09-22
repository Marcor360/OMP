import React, { useEffect, useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useI18n } from '@/src/i18n/index';
import { useUser } from '@/src/context/user-context';
import { AssignmentDetailSection } from '@/src/modules/assignments/components/AssignmentDetailSection';
import { getAssignmentById } from '@/src/modules/assignments/services/assignments.service';
import { Assignment } from '@/src/modules/assignments/types/assignment.types';
import { useAppColors } from '@/src/styles';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { canManageAssignments, canManageMeetings } from '@/src/utils/permissions/permissions';

export function AssignmentDetailScreen() {
  const { id, meetingId, source } = useLocalSearchParams<{
    id?: string;
    meetingId?: string;
    source?: 'meeting' | 'congregation';
  }>();
  const router = useRouter();
  const colors = useAppColors();
  const { appUser, congregationId, loadingProfile, profileError } = useUser();
  const { t } = useI18n();
  const canEditMeetingAssignment =
    canManageAssignments(appUser) && canManageMeetings(appUser);

  const requestKey = congregationId && id ? [congregationId, id, meetingId ?? '', source ?? ''].join(':') : null;
  const [assignmentState, setAssignmentState] = useState<{
    requestKey: string | null;
    assignment: Assignment | null;
    error: string | null;
  }>({ requestKey: null, assignment: null, error: null });

  useEffect(() => {
    if (loadingProfile || !congregationId || !id || !requestKey) return;

    let cancelled = false;

    void getAssignmentById({ congregationId, assignmentId: id, meetingId, source })
      .then((result) => {
        if (!cancelled) setAssignmentState({
          requestKey,
          assignment: result,
          error: result ? null : t('assignments.errorNotFound'),
        });
      })
      .catch((requestError) => {
        if (!cancelled) setAssignmentState({
          requestKey,
          assignment: null,
          error: formatFirestoreError(requestError),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [congregationId, id, loadingProfile, meetingId, requestKey, source, t]);

  const hasCurrentAssignment = assignmentState.requestKey === requestKey;
  const loading = loadingProfile || Boolean(requestKey && !hasCurrentAssignment);
  const assignment = hasCurrentAssignment ? assignmentState.assignment : null;
  const error = !requestKey && !loadingProfile
    ? profileError ?? t('assignments.errorLoadDetail')
    : hasCurrentAssignment ? assignmentState.error : null;

  if (loading) {
    return <LoadingState message={t('assignments.loadingDetail')} />;
  }

  if (error || !assignment) {
    return <ErrorState message={error ?? t('assignments.errorNotFound')} />;
  }

  const isEditableMeetingAssignment =
    canEditMeetingAssignment &&
    assignment.source === 'meeting' &&
    Boolean(assignment.meetingId) &&
    !assignment.sourceKey.startsWith('meeting-program:');

  const openEdit = () => {
    if (!assignment.meetingId) return;
    router.push(
      `/(protected)/assignments/edit/${encodeURIComponent(assignment.id)}?meetingId=${encodeURIComponent(assignment.meetingId)}` as never
    );
  };

  return (
    <ScreenContainer>
      <PageHeader
        title={t('assignments.detailTitle')}
        subtitle={t('assignments.detailSubtitle')}
        showBack
        actions={
          isEditableMeetingAssignment ? (
            <TouchableOpacity
              onPress={openEdit}
              accessibilityRole="button"
              accessibilityLabel={t('common.edit')}
              style={{
                minHeight: 36,
                paddingHorizontal: 12,
                borderRadius: 9,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: colors.primary,
              }}
            >
              <Ionicons name="create-outline" size={16} color={colors.onPrimary} />
              <ThemedText style={{ color: colors.onPrimary, fontWeight: '800' }}>
                {t('common.edit')}
              </ThemedText>
            </TouchableOpacity>
          ) : null
        }
      />

      {assignment.title ? (
        <ThemedText
          style={{
            marginHorizontal: 16,
            marginTop: 16,
            fontSize: 19,
            lineHeight: 24,
            fontWeight: '800',
          }}
        >
          {assignment.title}
        </ThemedText>
      ) : null}

      <AssignmentDetailSection assignment={assignment} />
    </ScreenContainer>
  );
}
