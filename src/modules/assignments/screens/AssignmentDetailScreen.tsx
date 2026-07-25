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

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loadingProfile) return;

    if (!congregationId || !id) {
      setError(profileError ?? t('assignments.errorLoadDetail'));
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const result = await getAssignmentById({
          congregationId,
          assignmentId: id,
          meetingId,
          source,
        });

        if (cancelled) return;

        if (!result) {
          setAssignment(null);
          setError(t('assignments.errorNotFound'));
          return;
        }

        setAssignment(result);
        setError(null);
      } catch (requestError) {
        if (cancelled) return;
        setAssignment(null);
        setError(formatFirestoreError(requestError));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [congregationId, id, loadingProfile, meetingId, profileError, source, t]);

  if (loading || loadingProfile) {
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
