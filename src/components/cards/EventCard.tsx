import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/src/components/themed-text';
import {
  CongregationEvent,
  EVENT_TYPE_LABELS,
} from '@/src/types/event';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

interface EventCardProps {
  event: CongregationEvent;
  canManage?: boolean;
  onEdit?: (event: CongregationEvent) => void;
  onDelete?: (event: CongregationEvent) => void;
}

const formatDate = (date: Date): string =>
  new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Mexico_City',
  }).format(date);

const resolveDateLabel = (event: CongregationEvent): string => {
  const start = event.startDate.toDate();
  const end = event.endDate.toDate();
  const sameDay =
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(start) ===
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(end);

  if (sameDay) {
    return formatDate(start);
  }

  return `Del ${formatDate(start)} al ${formatDate(end)}`;
};

const resolveMainText = (event: CongregationEvent): string => {
  if (event.type === 'visita_superintendente') {
    return event.superintendentName ?? 'Superintendente de Circuito';
  }

  return event.title ?? EVENT_TYPE_LABELS[event.type];
};

export function EventCard({
  event,
  canManage = false,
  onEdit,
  onDelete,
}: EventCardProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const accent = event.color;

  return (
    <View style={[styles.card, { borderLeftColor: accent }]}>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: accent + '20', borderColor: accent + '70' }]}>
          <ThemedText style={[styles.badgeText, { color: accent }]}>
            {EVENT_TYPE_LABELS[event.type]}
          </ThemedText>
        </View>

        {canManage ? (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => onEdit?.(event)}
              activeOpacity={0.75}
            >
              <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconButton, styles.deleteButton]}
              onPress={() => onDelete?.(event)}
              activeOpacity={0.75}
            >
              <Ionicons name="trash-outline" size={16} color={colors.error} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <ThemedText style={styles.title}>{resolveMainText(event)}</ThemedText>
      <View style={styles.metaRow}>
        <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
        <ThemedText style={styles.metaText}>Fecha: {resolveDateLabel(event)}</ThemedText>
      </View>

      {event.location ? (
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color={colors.textMuted} />
          <ThemedText style={styles.metaText}>Lugar: {event.location}</ThemedText>
        </View>
      ) : null}

      {event.superintendentWifeName ? (
        <View style={styles.metaRow}>
          <Ionicons name="people-outline" size={14} color={colors.textMuted} />
          <ThemedText style={styles.metaText}>
            Esposa: {event.superintendentWifeName}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 4,
      borderRadius: 8,
      padding: 12,
      gap: 8,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
    },
    badge: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      flexShrink: 1,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '800',
    },
    actions: {
      flexDirection: 'row',
      gap: 6,
    },
    iconButton: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
    },
    deleteButton: {
      backgroundColor: colors.error + '12',
      borderColor: colors.error + '45',
    },
    title: {
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    metaText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 17,
      color: colors.textMuted,
      fontWeight: '600',
    },
  });
