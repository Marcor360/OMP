import React from 'react';
import { Alert, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { EventCard } from '@/src/components/cards/EventCard';
import { ThemedText } from '@/src/components/themed-text';
import { deleteEvent } from '@/src/services/events/events-service';
import { CongregationEvent } from '@/src/types/event';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { formatFirestoreError } from '@/src/utils/errors/errors';

interface DashboardEventsSectionProps {
  events: CongregationEvent[];
  loading: boolean;
  error: string | null;
  canManage: boolean;
  congregationId: string | null;
  onRefresh: () => void;
}

const confirmDelete = (title: string): Promise<boolean> => {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`Deseas eliminar "${title}"?`));
  }

  return new Promise((resolve) => {
    Alert.alert('Eliminar evento', `Deseas eliminar "${title}"?`, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Eliminar', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
};

export function DashboardEventsSection({
  events,
  loading,
  error,
  canManage,
  congregationId,
  onRefresh,
}: DashboardEventsSectionProps) {
  const router = useRouter();
  const colors = useAppColors();
  const styles = createStyles(colors);

  const handleDelete = async (event: CongregationEvent) => {
    const title = event.title ?? event.superintendentName ?? 'evento';
    const confirmed = await confirmDelete(title);

    if (!confirmed) return;

    try {
      if (!congregationId) {
        throw new Error('No se encontro la congregacion del usuario actual.');
      }

      await deleteEvent({
        eventId: event.id,
        congregationId,
      });
      onRefresh();
    } catch (requestError) {
      Alert.alert('Error', formatFirestoreError(requestError));
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Eventos</ThemedText>
        {canManage ? (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/(protected)/events/create' as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color={colors.onPrimary} />
            <ThemedText style={styles.addButtonText}>Nuevo</ThemedText>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <ThemedText style={styles.emptyText}>Cargando eventos...</ThemedText>
      ) : error ? (
        <View style={styles.noticeBox}>
          <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
          <ThemedText style={styles.noticeText}>
            No se pudieron cargar los eventos por ahora.
          </ThemedText>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={onRefresh}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.retryText}>Reintentar</ThemedText>
          </TouchableOpacity>
        </View>
      ) : events.length === 0 ? (
        <ThemedText style={styles.emptyText}>
          No hay eventos proximos por el momento.
        </ThemedText>
      ) : (
        <View style={styles.list}>
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              canManage={canManage}
              onEdit={() => router.push(`/(protected)/events/edit/${event.id}` as any)}
              onDelete={handleDelete}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    section: {
      marginTop: 8,
      marginBottom: 16,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    addButtonText: {
      color: colors.onPrimary,
      fontSize: 12,
      fontWeight: '800',
    },
    list: {
      gap: 10,
    },
    emptyText: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
      paddingVertical: 16,
    },
    noticeBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.warning + '44',
      backgroundColor: colors.warning + '14',
      borderRadius: 8,
      padding: 10,
    },
    noticeText: {
      flex: 1,
      fontSize: 12,
      color: colors.warning,
      fontWeight: '700',
    },
    retryButton: {
      borderWidth: 1,
      borderColor: colors.warning + '55',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.surface,
    },
    retryText: {
      fontSize: 12,
      color: colors.warning,
      fontWeight: '800',
    },
  });
