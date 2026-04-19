import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

import { MidweekMeetingCard } from '@/src/components/cards/MidweekMeetingCard';
import { EmptyState } from '@/src/components/common/EmptyState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { RoleGuard } from '@/src/components/common/RoleGuard';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useMeetingsManagementPermission } from '@/src/hooks/use-meetings-management-permission';
import { importMidweekMeetingsFromPdf } from '@/src/services/meetings/midweek-import-service';
import {
  MidweekMeeting,
  getMidweekMeetingsByWeek,
} from '@/src/services/meetings/midweek-meetings-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { MeetingStatus, MEETING_STATUS_LABELS } from '@/src/types/meeting';
import { readDocumentPickerAssetAsBase64 } from '@/src/utils/files/document-picker';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { formatWeekLabel, getWeekEnd, getWeekStart, moveWeek } from '@/src/utils/dates/week-range';

const STATUS_FILTERS: { label: string; value: MeetingStatus | 'all' }[] = [
  { label: 'Todas', value: 'all' },
  { label: 'Pendientes', value: 'pending' },
  { label: 'Programadas', value: 'scheduled' },
  { label: 'En progreso', value: 'in_progress' },
  { label: 'Completadas', value: 'completed' },
  { label: 'Canceladas', value: 'cancelled' },
];

export function MidweekMeetingsListScreen() {
  const router = useRouter();
  const { congregationId, loading: permLoading, canManage } = useMeetingsManagementPermission();
  const colors = useAppColors();
  const styles = createStyles(colors);

  const [meetings, setMeetings] = useState<MidweekMeeting[]>([]);
  const [filter, setFilter] = useState<MeetingStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const weekEnd = useMemo(() => getWeekEnd(weekStart), [weekStart]);
  const weekLabel = useMemo(() => formatWeekLabel(weekStart, weekEnd), [weekEnd, weekStart]);

  const loadMeetings = useCallback(async (forceServer = false) => {
    if (permLoading) return;

    if (!congregationId) {
      setError('No se encontro congregationId en el perfil actual.');
      setLoading(false);
      return;
    }

    setError(null);
    if (!forceServer) {
      setLoading(true);
    }

    try {
      const docs = await getMidweekMeetingsByWeek(congregationId, weekStart, weekEnd, {
        forceServer,
        maxItems: 60,
      });
      setMeetings(docs);
      setError(null);
    } catch (requestError) {
      setError(formatFirestoreError(requestError));
      setMeetings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [congregationId, permLoading, weekEnd, weekStart]);

  useEffect(() => {
    void loadMeetings(false);
  }, [loadMeetings]);

  const filteredMeetings = useMemo(
    () => (filter === 'all' ? meetings : meetings.filter((meeting) => meeting.status === filter)),
    [filter, meetings]
  );

  const onRefresh = async () => {
    if (!congregationId) return;

    setRefreshing(true);
    await loadMeetings(true);
  };

  const goToPreviousWeek = () => {
    setWeekStart((current) => moveWeek(current, -1));
  };

  const goToNextWeek = () => {
    setWeekStart((current) => moveWeek(current, 1));
  };

  const goToCurrentWeek = () => {
    setWeekStart(getWeekStart(new Date()));
  };

  const handleImportPdf = async () => {
    if (!congregationId) return;

    try {
      const selection = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (selection.canceled || !selection.assets?.[0]) {
        return;
      }

      const pickedAsset = selection.assets[0];
      const base64Content = await readDocumentPickerAssetAsBase64(pickedAsset);

      if (!base64Content || base64Content.trim().length === 0) {
        Alert.alert('Error', 'No se pudo leer el contenido del PDF seleccionado.');
        return;
      }

      setImporting(true);

      const imported = await importMidweekMeetingsFromPdf({
        congregationId,
        pdfBase64: base64Content,
        fileName: pickedAsset.name,
      });

      const importedWeeks =
        imported.importedWeekLabels.length > 0
          ? `\n\nSemanas detectadas:\n- ${imported.importedWeekLabels.join('\n- ')}`
          : '';

      Alert.alert(
        'Importacion completada',
        `Semanas procesadas: ${imported.totalWeeks}\n` +
          `Creadas: ${imported.createdCount}\n` +
          `Actualizadas: ${imported.updatedCount}` +
          importedWeeks
      );

      await onRefresh();
    } catch (requestError) {
      Alert.alert('Error', formatFirestoreError(requestError));
    } finally {
      setImporting(false);
    }
  };

  if (loading || permLoading) {
    return <LoadingState message="Cargando reuniones entre semana..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRefresh} />;
  }

  const listHeader = (
    <>
      <PageHeader title="Reuniones VyMC" subtitle="Entre semana" showBack />

      <View style={styles.toolbar}>
        <ThemedText style={styles.count}>
          {filteredMeetings.length} reunion{filteredMeetings.length === 1 ? '' : 'es'}
        </ThemedText>

        <RoleGuard allowedRoles={['admin', 'supervisor']}>
          <View style={styles.toolbarActions}>
            <TouchableOpacity
              style={[styles.importButton, importing && styles.buttonDisabled]}
              onPress={handleImportPdf}
              activeOpacity={0.8}
              disabled={importing}
            >
              {importing ? (
                <ActivityIndicator size="small" color={colors.infoDark} />
              ) : (
                <Ionicons name="document-attach-outline" size={16} color={colors.infoDark} />
              )}
              <ThemedText style={styles.importButtonText}>Importar PDF</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push('/(protected)/meetings/create?type=midweek' as never)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <ThemedText style={styles.addButtonText}>Nueva VyMC</ThemedText>
            </TouchableOpacity>
          </View>
        </RoleGuard>
      </View>

      <View style={styles.weekNavRow}>
        <TouchableOpacity style={styles.weekNavButton} onPress={goToPreviousWeek} activeOpacity={0.8}>
          <Ionicons name="chevron-back-outline" size={16} color={colors.textMuted} />
          <ThemedText style={styles.weekNavButtonText}>Anterior</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.weekCurrentButton} onPress={goToCurrentWeek} activeOpacity={0.8}>
          <ThemedText style={styles.weekCurrentText}>{weekLabel}</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.weekNavButton} onPress={goToNextWeek} activeOpacity={0.8}>
          <ThemedText style={styles.weekNavButtonText}>Siguiente</ThemedText>
          <Ionicons name="chevron-forward-outline" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.importHintWrap}>
        <ThemedText style={styles.importHint}>
          Importar PDF es opcional. Tambien puedes crear reuniones manualmente.
        </ThemedText>
      </View>

      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((item) => (
          <TouchableOpacity
            key={item.value}
            style={[styles.filterChip, filter === item.value && styles.filterChipActive]}
            onPress={() => setFilter(item.value)}
            activeOpacity={0.8}
          >
            <ThemedText style={[styles.filterText, filter === item.value && styles.filterTextActive]}>
              {item.label}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <FlatList
        data={filteredMeetings}
        keyExtractor={(meeting) => meeting.id}
        renderItem={({ item }) => <MidweekMeetingCard meeting={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={onRefresh}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="book-outline"
              title="Sin reuniones entre semana"
              description={
                filter === 'all'
                  ? 'Aun no hay reuniones VyMC registradas.'
                  : `No hay reuniones ${MEETING_STATUS_LABELS[filter as MeetingStatus].toLowerCase()}.`
              }
              actionLabel={canManage ? 'Crear reunion VyMC' : undefined}
              onAction={
                canManage ? () => router.push('/(protected)/meetings/create?type=midweek' as never) : undefined
              }
            />
          </View>
        }
      />
    </ScreenContainer>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    toolbar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 10,
    },
    count: { fontSize: 13, color: colors.textMuted },
    toolbarActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
    },
    addButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    importButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.infoLight,
      borderWidth: 1,
      borderColor: colors.info + '55',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      minWidth: 120,
      justifyContent: 'center',
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    importButtonText: {
      color: colors.infoDark,
      fontWeight: '700',
      fontSize: 12,
    },
    importHintWrap: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
    },
    importHint: {
      fontSize: 12,
      color: colors.textMuted,
    },
    weekNavRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 8,
    },
    weekNavButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    weekNavButtonText: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
    },
    weekCurrentButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary + '55',
      backgroundColor: colors.primary + '12',
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    weekCurrentText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 12,
    },
    filterRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexWrap: 'wrap',
    },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
    filterTextActive: { color: '#fff' },
    listContent: {
      paddingBottom: 32,
    },
    separator: {
      height: 10,
    },
    emptyWrap: {
      paddingTop: 16,
      paddingHorizontal: 16,
    },
  });
