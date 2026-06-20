import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useI18n } from '@/src/i18n/index';
import { useUser } from '@/src/context/user-context';
import { getScheduledOutgoingTalksForWeek } from '@/src/modules/assignments/services/outgoing-talks.service';
import {
  OUTGOING_TALK_BLOCK_MESSAGE,
  getBlockedOutgoingTalkUserIds,
  isUserBlockedByOutgoingTalk,
} from '@/src/modules/assignments/utils/outgoing-talks';
import {
  ControlledReaderSlot,
  assignControlledReaderToMeeting,
  listControlledReaderSlots,
} from '@/src/modules/assignments/utils/meeting-readers';
import { getMeetingsByWeek } from '@/src/services/meetings/meetings-service';
import {
  ActiveCongregationUser,
  getActiveCongregationUsers,
} from '@/src/services/users/active-users-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { Meeting } from '@/src/types/meeting';
import { canManageHospitalityMicrophones } from '@/src/utils/permissions/permissions';
import { formatFirestoreError } from '@/src/utils/errors/errors';

type MeetingWithSlots = {
  meeting: Meeting;
  slots: ControlledReaderSlot[];
};

const toDate = (value: unknown): Date => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
};

const formatDate = (date: Date): string =>
  new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);

export function HospitalityMicrophonesReadersScreen() {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { appUser, congregationId, uid, loadingProfile } = useUser();
  const { t } = useI18n();
  const canManage = canManageHospitalityMicrophones(appUser);
  const [users, setUsers] = useState<ActiveCongregationUser[]>([]);
  const [meetings, setMeetings] = useState<MeetingWithSlots[]>([]);
  const [blockedByMeetingId, setBlockedByMeetingId] = useState<Record<string, string[]>>({});
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!congregationId || !canManage) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 70);
      end.setHours(23, 59, 59, 999);

      const [loadedUsers, loadedMeetings] = await Promise.all([
        getActiveCongregationUsers(congregationId),
        getMeetingsByWeek(congregationId, start, end, {
          includeMidweek: true,
          publicationStatus: 'all',
          forceServer: true,
          maxItems: 80,
        }),
      ]);

      setUsers(loadedUsers);
      const meetingsWithSlots = loadedMeetings
        .map((meeting) => ({ meeting, slots: listControlledReaderSlots(meeting) }))
        .filter((item) => item.slots.length > 0);

      const blockedEntries = await Promise.all(
        meetingsWithSlots.map(async ({ meeting }) => {
          const meetingDate = toDate(meeting.meetingDate ?? meeting.startDate);
          const outgoingTalks = await getScheduledOutgoingTalksForWeek(congregationId, meetingDate);
          return [
            meeting.id,
            Array.from(getBlockedOutgoingTalkUserIds(meetingDate, outgoingTalks)),
          ] as const;
        })
      );

      setMeetings(meetingsWithSlots);
      setBlockedByMeetingId(Object.fromEntries(blockedEntries));
    } catch (requestError) {
      setError(formatFirestoreError(requestError));
    } finally {
      setLoading(false);
    }
  }, [canManage, congregationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const usersById = useMemo(
    () => new Map(users.map((user) => [user.uid, user])),
    [users]
  );

  const assignReader = useCallback(
    async (meeting: Meeting, slot: ControlledReaderSlot, user: ActiveCongregationUser) => {
      if (!congregationId || !uid) return;

      const meetingDate = toDate(meeting.meetingDate ?? meeting.startDate);
      const saveKey = `${meeting.id}:${slot.assignmentKey}`;
      setSavingKey(saveKey);

      try {
        const outgoingTalks = await getScheduledOutgoingTalksForWeek(congregationId, meetingDate);
        if (isUserBlockedByOutgoingTalk(user.uid, meetingDate, outgoingTalks)) {
          Alert.alert('No disponible', `${user.displayName}: ${OUTGOING_TALK_BLOCK_MESSAGE}.`);
          return;
        }

        await assignControlledReaderToMeeting({
          congregationId,
          meeting,
          assignmentKey: slot.assignmentKey,
          user,
          actorUid: uid,
        });

        setExpandedSlot(null);
        await load();
      } catch (requestError) {
        Alert.alert('Error', formatFirestoreError(requestError));
      } finally {
        setSavingKey(null);
      }
    },
    [congregationId, load, uid]
  );

  if (loadingProfile || loading) {
    return <LoadingState message={t('hospitality.readersLoading')} />;
  }

  if (!congregationId) {
    return <ErrorState message={t('dashboard.noCongregation')} />;
  }

  if (!canManage) {
    return <ErrorState message={t('hospitality.scheduleNoPermission')} />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <PageHeader title={t('hospitality.readersTitle')} subtitle={t('hospitality.readersSubtitle')} showBack />
      <ScrollView contentContainerStyle={styles.content}>
        {meetings.length === 0 ? (
          <View style={styles.empty}>
            <ThemedText style={styles.emptyText}>{t('hospitality.readersEmpty')}</ThemedText>
          </View>
        ) : (
          meetings.map(({ meeting, slots }) => {
            const meetingDate = toDate(meeting.meetingDate ?? meeting.startDate);
            return (
              <View key={meeting.id} style={styles.meetingBlock}>
                <View style={styles.meetingHeader}>
                  <View style={styles.meetingTitleWrap}>
                    <ThemedText style={styles.meetingTitle}>{meeting.title}</ThemedText>
                    <ThemedText style={styles.meetingDate}>{formatDate(meetingDate)}</ThemedText>
                  </View>
                  <View style={styles.typePill}>
                    <ThemedText style={styles.typePillText}>
                      {meeting.type === 'midweek' || meeting.meetingCategory === 'midweek'
                        ? t('hospitality.scheduleMidweek')
                        : t('hospitality.scheduleWeekend')}
                    </ThemedText>
                  </View>
                </View>

                {slots.map((slot) => {
                  const slotKey = `${meeting.id}:${slot.assignmentKey}`;
                  const expanded = expandedSlot === slotKey;
                  const selectedName =
                    slot.assignedUserName ??
                    (slot.assignedUserId ? usersById.get(slot.assignedUserId)?.displayName : undefined) ??
                    t('hospitality.scheduleUnassigned');
                  const isSaving = savingKey === slotKey;

                  return (
                    <View key={slotKey} style={styles.slotBlock}>
                      <TouchableOpacity
                        style={styles.slotButton}
                        onPress={() => setExpandedSlot(expanded ? null : slotKey)}
                        disabled={isSaving}
                      >
                        <View style={styles.slotTextWrap}>
                          <ThemedText style={styles.slotTitle}>{slot.title}</ThemedText>
                          <ThemedText style={styles.slotAssignee}>{selectedName}</ThemedText>
                        </View>
                        <Ionicons
                          name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                          size={18}
                          color={colors.textMuted}
                        />
                      </TouchableOpacity>

                      {expanded ? (
                        <View style={styles.userList}>
                          {users.map((user) => (
                            <TouchableOpacity
                              key={user.uid}
                              style={[
                                styles.userOption,
                                blockedByMeetingId[meeting.id]?.includes(user.uid) && styles.userOptionDisabled,
                              ]}
                              onPress={() => void assignReader(meeting, slot, user)}
                              disabled={isSaving || blockedByMeetingId[meeting.id]?.includes(user.uid)}
                            >
                              <ThemedText
                                style={[
                                  styles.userName,
                                  blockedByMeetingId[meeting.id]?.includes(user.uid) && styles.userNameDisabled,
                                ]}
                              >
                                {user.displayName}
                              </ThemedText>
                              {user.email ? <ThemedText style={styles.userEmail}>{user.email}</ThemedText> : null}
                              {blockedByMeetingId[meeting.id]?.includes(user.uid) ? (
                                <ThemedText style={styles.blockedText}>{OUTGOING_TALK_BLOCK_MESSAGE}</ThemedText>
                              ) : null}
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            );
          })
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    content: {
      padding: 16,
      gap: 12,
    },
    empty: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 14,
    },
    meetingBlock: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      gap: 12,
    },
    meetingHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 10,
      alignItems: 'center',
    },
    meetingTitleWrap: {
      flex: 1,
      gap: 2,
    },
    meetingTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '800',
    },
    meetingDate: {
      color: colors.textMuted,
      fontSize: 12,
    },
    typePill: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: colors.backgroundLight,
    },
    typePillText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
    },
    slotBlock: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: colors.backgroundLight,
    },
    slotButton: {
      padding: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    slotTextWrap: {
      flex: 1,
      gap: 2,
    },
    slotTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    slotAssignee: {
      color: colors.textMuted,
      fontSize: 12,
    },
    userList: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    userOption: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    userOptionDisabled: {
      opacity: 0.55,
    },
    userName: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '600',
    },
    userNameDisabled: {
      color: colors.textDisabled,
    },
    userEmail: {
      color: colors.textMuted,
      fontSize: 11,
    },
    blockedText: {
      color: colors.warning,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 2,
    },
  });
