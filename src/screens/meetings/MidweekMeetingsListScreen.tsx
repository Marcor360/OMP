import React, { useEffect, useMemo, useState } from 'react';
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
import { useUser } from '@/src/context/user-context';
import { importMidweekMeetingsFromPdf } from '@/src/services/meetings/midweek-import-service';
import {
  MidweekMeeting,
  getMidweekMeetings,
  subscribeToMidweekMeetings,
} from '@/src/services/meetings/midweek-meetings-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { MeetingStatus, MEETING_STATUS_LABELS } from '@/src/types/meeting';
import { readDocumentPickerAssetAsBase64 } from '@/src/utils/files/document-picker';
import { formatFirestoreError } from '@/src/utils/errors/errors';

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
  const { congregationId, loadingProfile, isAdminOrSupervisor, profileError } = useUser();
  const colors = useAppColors();
  const styles = createStyles(colors);

  const [meetings, setMeetings] = useState<MidweekMeeting[]>([]);
  const [filter, setFilter] = useState<MeetingStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loadingProfile) return;

    if (!congregationId) {
      setError(profileError ?? 'No se encontro congregationId en el perfil actual.');
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);

    const unsubscribe = subscribeToMidweekMeetings(
      congregationId,
      (docs) => {
        setMeetings(docs);
        setLoading(false);
        setRefreshing(false);
      },
      (snapshotError) => {
        setError(formatFirestoreError(snapshotError));
        setLoading(false);
        setRefreshing(false);
      }
    );

    return unsubscribe;
  }, [congregationId, loadingProfile, profileError]);

  const filteredMeetings = useMemo(
    () => (filter === 'all' ? meetings : meetings.filter((meeting) => meeting.status === filter)),
    [filter, meetings]
  );

  const onRefresh = async () => {
    if (!congregationId) return;

    setRefreshing(true);

    try {
      const docs = await getMidweekMeetings(congregationId);
      setMeetings(docs);
    } catch (requestError) {
      setError(formatFirestoreError(requestError));
    } finally {
      setRefreshing(false);
    }
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

  if (loading || loadingProfile) {
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
              onPress={() => router.push('/(protected)/meetings/midweek/create')}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <ThemedText style={styles.addButtonText}>Nueva VyMC</ThemedText>
            </TouchableOpacity>
          </View>
        </RoleGuard>
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
              actionLabel={isAdminOrSupervisor ? 'Crear reunion VyMC' : undefined}
              onAction={
                isAdminOrSupervisor ? () => router.push('/(protected)/meetings/midweek/create') : undefined
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
