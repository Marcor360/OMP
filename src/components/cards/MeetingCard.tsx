import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/src/components/themed-text';
import { StatusBadge, meetingStatusColor } from '@/src/components/common/StatusBadge';
import { useI18n } from '@/src/i18n/index';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { Meeting } from '@/src/types/meeting';
import { formatDate } from '@/src/utils/dates/dates';

interface MeetingCardProps {
  meeting: Meeting;
  onPress?: () => void;
}

const meetingTypeIcon: Record<string, keyof typeof Ionicons.glyphMap> = {
  internal: 'people-outline',
  external: 'business-outline',
  review: 'clipboard-outline',
  training: 'school-outline',
  midweek: 'book-outline',
  weekend: 'calendar-clear-outline',
};

export function MeetingCard({ meeting, onPress }: MeetingCardProps) {
  const router = useRouter();
  const { t } = useI18n();
  const colors = useAppColors();
  const styles = createStyles(colors);

  const handlePress = () => {
    if (onPress) onPress();
    else router.push(`/(protected)/meetings/${meeting.id}` as any);
  };

  const meetingTypeLabelByType: Record<Meeting['type'], string> = {
    internal: t('meeting.type.internal'),
    external: t('meeting.type.external'),
    review: t('meeting.type.review'),
    training: t('meeting.type.training'),
    midweek: t('meeting.type.midweek'),
    weekend: t('meeting.type.weekend'),
  };

  const meetingStatusLabelByStatus: Record<Meeting['status'], string> = {
    pending: t('meeting.status.pending'),
    scheduled: t('meeting.status.scheduled'),
    in_progress: t('meeting.status.in_progress'),
    completed: t('meeting.status.completed'),
    cancelled: t('meeting.status.cancelled'),
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.8}>
      <View style={styles.row}>
        <View style={[styles.typeIcon, { backgroundColor: colors.primary + '22' }]}>
          <Ionicons name={meetingTypeIcon[meeting.type] ?? 'calendar-outline'} size={20} color={colors.primary} />
        </View>
        <View style={styles.info}>
          <ThemedText style={styles.title} numberOfLines={2}>
            {meeting.title}
          </ThemedText>
          <ThemedText style={styles.type}>{meetingTypeLabelByType[meeting.type]}</ThemedText>
        </View>
        <StatusBadge
          label={meetingStatusLabelByStatus[meeting.status]}
          color={meetingStatusColor[meeting.status]}
          size="sm"
        />
      </View>

      <View style={styles.footer}>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
          <ThemedText style={styles.meta}>{formatDate(meeting.meetingDate ?? meeting.startDate)}</ThemedText>
        </View>
        {meeting.location ? (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={13} color={colors.textMuted} />
            <ThemedText style={styles.meta} numberOfLines={1}>
              {meeting.location}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    typeIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    info: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
      lineHeight: 20,
    },
    type: {
      fontSize: 12,
      color: colors.textMuted,
    },
    footer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    meta: {
      fontSize: 12,
      color: colors.textMuted,
    },
  });
