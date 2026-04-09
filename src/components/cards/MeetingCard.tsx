import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/src/components/themed-text';
import {
  StatusBadge,
  meetingStatusColor,
} from '@/src/components/common/StatusBadge';
import { AppColors } from '@/src/constants/app-colors';
import { Meeting, MEETING_STATUS_LABELS, MEETING_TYPE_LABELS } from '@/src/types/meeting';
import { formatDate, formatTime } from '@/src/utils/dates/dates';

interface MeetingCardProps {
  meeting: Meeting;
  onPress?: () => void;
}

const meetingTypeIcon: Record<string, keyof typeof Ionicons.glyphMap> = {
  internal: 'people-outline',
  external: 'business-outline',
  review: 'clipboard-outline',
  training: 'school-outline',
};

export function MeetingCard({ meeting, onPress }: MeetingCardProps) {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) onPress();
    else router.push(`/(protected)/meetings/${meeting.id}` as any);
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.8}>
      <View style={styles.row}>
        <View style={[styles.typeIcon, { backgroundColor: AppColors.primary + '22' }]}>
          <Ionicons
            name={meetingTypeIcon[meeting.type] ?? 'calendar-outline'}
            size={20}
            color={AppColors.primary}
          />
        </View>
        <View style={styles.info}>
          <ThemedText style={styles.title} numberOfLines={2}>
            {meeting.title}
          </ThemedText>
          <ThemedText style={styles.type}>
            {MEETING_TYPE_LABELS[meeting.type]}
          </ThemedText>
        </View>
        <StatusBadge
          label={MEETING_STATUS_LABELS[meeting.status]}
          color={meetingStatusColor[meeting.status]}
          size="sm"
        />
      </View>

      <View style={styles.footer}>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={13} color={AppColors.textMuted} />
          <ThemedText style={styles.meta}>
            {formatDate(meeting.startDate)}
          </ThemedText>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={13} color={AppColors.textMuted} />
          <ThemedText style={styles.meta}>
            {formatTime(meeting.startDate)} – {formatTime(meeting.endDate)}
          </ThemedText>
        </View>
        {meeting.location ? (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={13} color={AppColors.textMuted} />
            <ThemedText style={styles.meta} numberOfLines={1}>
              {meeting.location}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
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
    color: AppColors.textPrimary,
    lineHeight: 20,
  },
  type: {
    fontSize: 12,
    color: AppColors.textMuted,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  meta: {
    fontSize: 12,
    color: AppColors.textMuted,
  },
});
