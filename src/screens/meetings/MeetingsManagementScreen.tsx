import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { MeetingCard } from '@/src/components/cards/MeetingCard';
import { EmptyState } from '@/src/components/common/EmptyState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useMeetingsManagementPermission } from '@/src/hooks/use-meetings-management-permission';
import { setMeetingPublicationStatus } from '@/src/services/meetings/meeting-publish-service';
import { deleteMeeting, getMeetingsByWeek } from '@/src/services/meetings/meetings-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { Meeting } from '@/src/types/meeting';
import { MeetingPublicationStatus } from '@/src/types/meeting/program';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { formatWeekLabel, getWeekEnd, getWeekStart, moveWeek } from '@/src/utils/dates/week-range';

const PUBLICATION_FILTERS: { label: string; value: MeetingPublicationStatus | 'all' }[] = [
  { label: 'Todas', value: 'all' },
  { label: 'Borrador', value: 'draft' },
  { label: 'Publicada', value: 'published' },
];

export function MeetingsManagementScreen() {
  const router = useRouter();
  const { canManage, congregationId, loading: loadingPermission } = useMeetingsManagementPermission();
  const colors = useAppColors();
  const styles = createStyles(colors);

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [publicationFilter, setPublicationFilter] = useState<MeetingPublicationStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingMeetingId, setDeletingMeetingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const weekEnd = useMemo(() => getWeekEnd(weekStart), [weekStart]);
  const weekLabel = useMemo(() => formatWeekLabel(weekStart, weekEnd), [weekStart, weekEnd]);

  const loadMeetings = useCallback(
    async (forceServer = false) => {
      if (!congregationId) {
        setMeetings([]);
        setError('No se encontro la congregacion del perfil actual.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (!forceServer) setLoading(true);
      setError(null);

      try {
        const docs = await getMeetingsByWeek(congregationId, weekStart, weekEnd, {
          forceServer,
          includeMidweek: true,
          publicationStatus: publicationFilter,
          maxItems: 160,
        });
        setMeetings(docs);
      } catch (requestError) {
        setMeetings([]);
        setError(formatFirestoreError(requestError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [congregationId, publicationFilter, weekEnd, weekStart]
  );

  useEffect(() => {
    if (!canManage) return;
    void loadMeetings(false);
  }, [canManage, loadMeetings]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMeetings(true);
  };

  const togglePublication = async (meeting: Meeting) => {
    if (!congregationId) return;

    const nextStatus: MeetingPublicationStatus =
      meeting.publicationStatus === 'published' ? 'draft' : 'published';

    try {
      const result = await setMeetingPublicationStatus({
        congregationId,
        meetingId: meeting.id,
        publicationStatus: nextStatus,
      });

      if (!result.ok) {
        Alert.alert('Validacion', result.errors.join('\n'));
        return;
      }

      Alert.alert('Exito', nextStatus === 'published' ? 'Reunion publicada.' : 'Reunion enviada a borrador.');
      await onRefresh();
    } catch (requestError) {
      Alert.alert('Error', formatFirestoreError(requestError));
    }
  };

  const deleteMeetingWithConfirmation = (meeting: Meeting) => {
    if (!congregationId || deletingMeetingId) return;

    Alert.alert(
      'Eliminar reunion',
      'Esta accion eliminara la reunion de forma permanente. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void executeDeleteMeeting(meeting);
          },
        },
      ]
    );
  };

  const executeDeleteMeeting = async (meeting: Meeting) => {
    if (!congregationId) return;

    setDeletingMeetingId(meeting.id);

    try {
      await deleteMeeting(congregationId, meeting.id);
      setMeetings((current) => current.filter((item) => item.id !== meeting.id));
      Alert.alert('Exito', 'Reunion eliminada correctamente.');
    } catch (requestError) {
      Alert.alert('Error', formatFirestoreError(requestError));
    } finally {
      setDeletingMeetingId(null);
    }
  };

  if (loading || loadingPermission) return <LoadingState message="Cargando gestion de reuniones..." />;
  if (error) return <ErrorState message={error} onRetry={onRefresh} />;

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <FlatList
        data={meetings}
        keyExtractor={(meeting) => meeting.id}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={onRefresh}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <PageHeader title="Gestion de reuniones" subtitle="Admin y Supervisor" showBack />

            <View style={styles.actionBar}>
              <TouchableOpacity style={styles.createButton} onPress={() => router.push('/(protected)/meetings/create?type=weekend' as never)}>
                <Ionicons name="add-outline" size={16} color="#fff" />
                <ThemedText style={styles.createButtonText}>Nueva fin de semana</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createButton} onPress={() => router.push('/(protected)/meetings/create?type=midweek' as never)}>
                <Ionicons name="add-outline" size={16} color="#fff" />
                <ThemedText style={styles.createButtonText}>Nueva VyMC</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/(protected)/meetings/midweek' as never)}>
                <Ionicons name="document-attach-outline" size={16} color={colors.infoDark} />
                <ThemedText style={styles.secondaryButtonText}>Importar PDF VyMC</ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              <TouchableOpacity style={styles.navButton} onPress={() => setWeekStart((current) => moveWeek(current, -1))}>
                <Ionicons name="chevron-back-outline" size={16} color={colors.textMuted} />
                <ThemedText style={styles.navText}>Anterior</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity style={styles.weekLabelButton} onPress={() => setWeekStart(getWeekStart(new Date()))}>
                <ThemedText style={styles.weekLabel}>{weekLabel}</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity style={styles.navButton} onPress={() => setWeekStart((current) => moveWeek(current, 1))}>
                <ThemedText style={styles.navText}>Siguiente</ThemedText>
                <Ionicons name="chevron-forward-outline" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.filtersRow}>
              {PUBLICATION_FILTERS.map((filterOption) => (
                <TouchableOpacity
                  key={filterOption.value}
                  style={[styles.filterChip, publicationFilter === filterOption.value && styles.filterChipActive]}
                  onPress={() => setPublicationFilter(filterOption.value)}
                >
                  <ThemedText style={[styles.filterChipText, publicationFilter === filterOption.value && styles.filterChipTextActive]}>
                    {filterOption.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.meetingWrap}>
            <MeetingCard meeting={item} />
            <View style={styles.meetingActions}>
              <TouchableOpacity style={styles.smallAction} onPress={() => router.push(`/(protected)/meetings/${item.id}` as never)}>
                <Ionicons name="eye-outline" size={15} color={colors.textPrimary} />
                <ThemedText style={styles.smallActionText}>Ver</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.smallAction} onPress={() => router.push(`/(protected)/meetings/edit/${item.id}` as never)}>
                <Ionicons name="pencil-outline" size={15} color={colors.textPrimary} />
                <ThemedText style={styles.smallActionText}>Editar</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.publishAction} onPress={() => void togglePublication(item)}>
                <Ionicons name={item.publicationStatus === 'published' ? 'close-circle-outline' : 'send-outline'} size={15} color={item.publicationStatus === 'published' ? colors.error : colors.successDark} />
                <ThemedText style={[styles.publishActionText, { color: item.publicationStatus === 'published' ? colors.error : colors.successDark }]}>
                  {item.publicationStatus === 'published' ? 'Despublicar' : 'Publicar'}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteAction, deletingMeetingId === item.id && styles.actionDisabled]}
                onPress={() => deleteMeetingWithConfirmation(item)}
                disabled={Boolean(deletingMeetingId)}
              >
                <Ionicons
                  name={deletingMeetingId === item.id ? 'hourglass-outline' : 'trash-outline'}
                  size={15}
                  color={colors.error}
                />
                <ThemedText style={styles.deleteActionText}>Eliminar</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState icon="calendar-outline" title="Sin reuniones" description="No hay reuniones para los filtros actuales." />
          </View>
        }
      />
    </ScreenContainer>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    listContent: { paddingHorizontal: 14, paddingBottom: 28, gap: 10 },
    actionBar: { gap: 8, marginBottom: 10 },
    createButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
    createButtonText: { color: '#fff', fontWeight: '800', fontSize: 13 },
    secondaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.info + '66', backgroundColor: colors.infoLight, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
    secondaryButtonText: { color: colors.infoDark, fontWeight: '700', fontSize: 13 },
    weekRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
    navButton: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: colors.surface },
    navText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
    weekLabelButton: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primary + '55', borderRadius: 8, backgroundColor: colors.primary + '10', paddingVertical: 7, paddingHorizontal: 8 },
    weekLabel: { color: colors.primary, fontWeight: '700', fontSize: 12 },
    filtersRow: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
    filterChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.surface },
    filterChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
    filterChipText: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
    filterChipTextActive: { color: '#fff' },
    meetingWrap: { gap: 8 },
    meetingActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
    smallAction: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.surface },
    smallActionText: { fontSize: 12, color: colors.textPrimary, fontWeight: '700' },
    publishAction: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.surface },
    publishActionText: { fontSize: 12, fontWeight: '800' },
    deleteAction: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: colors.error + '55', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.error + '10' },
    deleteActionText: { fontSize: 12, fontWeight: '800', color: colors.error },
    actionDisabled: { opacity: 0.55 },
    emptyWrap: { paddingTop: 18 },
  });
