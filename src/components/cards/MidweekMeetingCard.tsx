import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { StatusBadge, useStatusColors } from '@/src/components/common/StatusBadge';
import { ThemedText } from '@/src/components/themed-text';
import { MidweekMeeting } from '@/src/services/meetings/midweek-meetings-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { MEETING_DISPLAY_STATE_LABELS, resolveMeetingDisplayState } from '@/src/types/meeting';
import { formatDate, formatTime } from '@/src/utils/dates/dates';
import { useOptionalI18n } from '@/src/i18n/index';

interface MidweekMeetingCardProps {
  meeting: MidweekMeeting;
  onPress?: () => void;
}

export function MidweekMeetingCard({ meeting, onPress }: MidweekMeetingCardProps) {
  const router = useRouter();
  const colors = useAppColors();
  const { meetingStatusColor } = useStatusColors();
  const styles = createStyles(colors);
  const i18n = useOptionalI18n();

  const totalAssignments = meeting.midweekSections.reduce(
    (total, section) => total + section.items.length,
    0
  );
  const displayState = resolveMeetingDisplayState(meeting.publicationStatus);

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }

    router.push(`/(protected)/meetings/edit/${meeting.id}` as never);
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.8}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="book-outline" size={20} color={colors.primary} />
        </View>

        <View style={styles.headerInfo}>
          <ThemedText style={styles.weekLabel}>{meeting.weekLabel || (i18n?.t('components.cards.meetingNoLabel') ?? 'Semana sin etiqueta')}</ThemedText>
          <ThemedText style={styles.title} numberOfLines={2}>
            {meeting.title}
          </ThemedText>
        </View>

        <StatusBadge
          size="sm"
          label={i18n?.t(`meeting.state.${displayState}`) ?? MEETING_DISPLAY_STATE_LABELS[displayState]}
          color={meetingStatusColor[displayState]}
        />
      </View>

      <View style={styles.metaRow}>
        <Ionicons name="library-outline" size={13} color={colors.textMuted} />
        <ThemedText style={styles.metaText} numberOfLines={1}>
          {i18n?.t('components.cards.meetingReading') ?? 'Lectura:'} {meeting.bibleReading || (i18n?.t('components.cards.meetingNoReading') ?? 'No definida')}
        </ThemedText>
      </View>

      <View style={styles.metaRow}>
        <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
        <ThemedText style={styles.metaText}>
          {formatDate(meeting.startDate)} · {formatTime(meeting.startDate)}
        </ThemedText>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerChip}>
          <ThemedText style={styles.footerText}>
            {i18n?.t('components.cards.meetingSections', { count: meeting.midweekSections.length, defaultValue: `${meeting.midweekSections.length} secciones` })}
          </ThemedText>
        </View>
        <View style={styles.footerChip}>
          <ThemedText style={styles.footerText}>
            {i18n?.t('components.cards.meetingParts', { count: totalAssignments, defaultValue: `${totalAssignments} partes` })}
          </ThemedText>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      gap: 10,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: colors.primary + '22',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerInfo: {
      flex: 1,
      gap: 2,
    },
    weekLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      lineHeight: 20,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    metaText: {
      fontSize: 12,
      color: colors.textMuted,
      flex: 1,
    },
    footer: {
      flexDirection: 'row',
      gap: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    footerChip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: colors.backgroundLight,
    },
    footerText: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '600',
    },
  });

