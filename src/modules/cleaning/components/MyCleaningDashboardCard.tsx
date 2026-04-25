import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/src/components/themed-text';
import { useAppColors, type AppColors as AppColorSet } from '@/src/styles';
import { MyCleaningDashboardSummary } from '@/src/modules/cleaning/services/my-cleaning-dashboard-service';
import { ASSIGNMENT_STATUS_LABELS } from '@/src/modules/assignments/types/assignment.types';

interface MyCleaningDashboardCardProps {
  summary: MyCleaningDashboardSummary | null;
  loading?: boolean;
  error?: string | null;
  canOpenDetails?: boolean;
}

const formatCleaningDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Sin fecha';

  return parsed.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
  });
};

export function MyCleaningDashboardCard({
  summary,
  loading = false,
  error = null,
  canOpenDetails = false,
}: MyCleaningDashboardCardProps) {
  const colors = useAppColors();
  const router = useRouter();
  const styles = createStyles(colors);
  const hasGroup = Boolean(summary?.groupId);

  const handlePress = () => {
    if (canOpenDetails && summary?.groupId) {
      router.push(`/(protected)/cleaning/${summary.groupId}` as any);
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.88}
      onPress={handlePress}
      disabled={!canOpenDetails || !summary?.groupId}
    >
      <View style={styles.header}>
        <View style={styles.iconBadge}>
          <Ionicons name="sparkles-outline" size={18} color={colors.warning} />
        </View>
        <View style={styles.headerText}>
          <ThemedText style={styles.label}>Limpieza</ThemedText>
          <ThemedText style={styles.title} numberOfLines={1}>
            {hasGroup ? summary?.groupName ?? 'Mi grupo' : 'Sin grupo asignado'}
          </ThemedText>
        </View>
        {canOpenDetails && summary?.groupId ? (
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        ) : null}
      </View>

      {error ? (
        <ThemedText style={styles.mutedText}>{error}</ThemedText>
      ) : loading && !summary ? (
        <ThemedText style={styles.mutedText}>Cargando tus dias de limpieza...</ThemedText>
      ) : hasGroup && summary?.days.length ? (
        <View style={styles.days}>
          {summary.days.map((day) => (
            <View key={day.sourceKey} style={styles.dayRow}>
              <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
              <ThemedText style={styles.dayText} numberOfLines={1}>
                {formatCleaningDate(day.date)}
              </ThemedText>
              {day.status ? (
                <View style={styles.statusPill}>
                  <ThemedText style={styles.statusText}>
                    {ASSIGNMENT_STATUS_LABELS[day.status]}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : hasGroup ? (
        <ThemedText style={styles.mutedText}>
          No hay dias de limpieza proximos para tu grupo.
        </ThemedText>
      ) : (
        <ThemedText style={styles.mutedText}>
          Cuando te agreguen a un grupo, aqui apareceran tus proximos dias.
        </ThemedText>
      )}
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
      marginBottom: 16,
      gap: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    iconBadge: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.warning + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: {
      flex: 1,
      minWidth: 0,
    },
    label: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    title: {
      fontSize: 16,
      color: colors.textPrimary,
      fontWeight: '800',
      marginTop: 2,
    },
    mutedText: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 18,
    },
    days: {
      gap: 8,
    },
    dayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 28,
    },
    dayText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    statusPill: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    statusText: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '700',
    },
  });
