import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { EventCard } from '@/src/components/cards/EventCard';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import { useI18n } from '@/src/i18n';
import { getEventById } from '@/src/services/events/events-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { CongregationEvent } from '@/src/types/event';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { canManageEvents } from '@/src/utils/permissions/permissions';

export function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { appUser, congregationId, loadingProfile, profileError } = useUser();
  const { formatDate, t } = useI18n();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const canManage = canManageEvents(appUser);

  const requestKey = congregationId && id ? `${congregationId}:${id}` : null;
  const [eventState, setEventState] = useState<{
    requestKey: string | null;
    event: CongregationEvent | null;
    error: string | null;
  }>({ requestKey: null, event: null, error: null });

  useEffect(() => {
    if (loadingProfile || !congregationId || !id || !requestKey) return;

    let active = true;

    void getEventById(id)
      .then((doc) => {
        if (!active) return;
        // getEventById no filtra por congregacion: la coleccion 'events' es raiz,
        // asi que la pertenencia se verifica aqui antes de mostrar cualquier dato.
        if (!doc || doc.congregationId !== congregationId) {
          setEventState({ requestKey, event: null, error: t('eventDetail.notFound') });
          return;
        }

        setEventState({ requestKey, event: doc, error: null });
      })
      .catch((requestError) => {
        if (active) setEventState({ requestKey, event: null, error: formatFirestoreError(requestError) });
      });

    return () => {
      active = false;
    };
  }, [congregationId, id, loadingProfile, requestKey, t]);

  const hasCurrentEvent = eventState.requestKey === requestKey;
  const loading = loadingProfile || Boolean(requestKey && !hasCurrentEvent);
  const event = hasCurrentEvent ? eventState.event : null;
  const error = !requestKey && !loadingProfile
    ? profileError ?? t('eventDetail.notFound')
    : hasCurrentEvent ? eventState.error : null;

  if (loading) return <LoadingState message={t('eventDetail.loading')} />;
  if (error || !event) return <ErrorState message={error ?? t('eventDetail.notFound')} />;

  const formatEventDate = (date: Date): string =>
    formatDate(date, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Mexico_City',
    });
  const dateRangeLabel = event.startDate.toMillis() === event.endDate.toMillis()
    || formatEventDate(event.startDate.toDate()) === formatEventDate(event.endDate.toDate())
    ? formatEventDate(event.startDate.toDate())
    : `${formatEventDate(event.startDate.toDate())} - ${formatEventDate(event.endDate.toDate())}`;

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <PageHeader
        title={t('eventDetail.title')}
        showBack
        actions={
          canManage ? (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => router.push(`/(protected)/events/edit/${event.id}` as never)}
            >
              <Ionicons name="pencil-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <EventCard event={event} />

        <View style={styles.detailCard}>
          <DetailRow icon="calendar-outline" label={t('eventDetail.date')} value={dateRangeLabel} colors={colors} />
          <DetailRow
            icon="location-outline"
            label={t('eventDetail.location')}
            value={event.location ?? t('eventDetail.noLocation')}
            colors={colors}
          />
          {event.superintendentName ? (
            <DetailRow
              icon="person-outline"
              label={t('eventDetail.superintendent')}
              value={event.superintendentName}
              colors={colors}
            />
          ) : null}
          {event.superintendentWifeName ? (
            <DetailRow
              icon="people-outline"
              label={t('eventDetail.superintendentWife')}
              value={event.superintendentWifeName}
              colors={colors}
            />
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function DetailRow({
  icon,
  label,
  value,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  colors: AppColorSet;
}) {
  const styles = createStyles(colors);
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <View style={styles.detailText}>
        <ThemedText style={styles.detailLabel}>{label}</ThemedText>
        <ThemedText style={styles.detailValue}>{value}</ThemedText>
      </View>
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    content: { padding: 14, paddingBottom: 28, gap: 12 },
    editBtn: { padding: 8, borderRadius: 8, backgroundColor: colors.primary + '18' },
    detailCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.surface,
      padding: 14,
      gap: 14,
    },
    detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    detailText: { flex: 1, gap: 2 },
    detailLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
    detailValue: { fontSize: 15, color: colors.textPrimary, fontWeight: '700' },
  });
