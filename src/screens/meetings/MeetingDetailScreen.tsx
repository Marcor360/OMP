import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, Share, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import {
  buildMeetingProgramFromMeeting,
  getZoomFieldsFromSections,
} from '@/src/services/meetings/meeting-program-utils';
import {
  extractWeekendSessionsFromSections,
  getWeekendRegisteredDisplayName,
  getWeekendSpeakerDisplayName,
} from '@/src/services/meetings/weekend-meeting-adapter';
import { deleteMeeting, getMeetingById } from '@/src/services/meetings/meetings-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { Meeting } from '@/src/types/meeting';
import { MeetingColorToken } from '@/src/types/meeting/program';
import { formatDate } from '@/src/utils/dates/dates';
import { formatFirestoreError } from '@/src/utils/errors/errors';

const SECTION_COLOR_MAP: Record<MeetingColorToken, string> = {
  blue: '#3E7FA3',
  indigo: '#5A70B7',
  orange: '#D29A00',
  red: '#C52D11',
  green: '#2B7F00',
  teal: '#3E9C86',
  dark: '#3C3E41',
};

const normalizeText = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export function MeetingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { congregationId, loadingProfile, profileError, isAdminOrSupervisor } = useUser();
  const colors = useAppColors();
  const styles = createStyles(colors);

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loadingProfile) return;

    if (!congregationId || !id) {
      setError(profileError ?? 'No se encontro la congregacion del usuario actual.');
      setLoading(false);
      return;
    }

    getMeetingById(congregationId, id)
      .then((doc) => {
        if (!doc) {
          setError('Reunion no encontrada.');
          return;
        }

        if (!isAdminOrSupervisor && doc.publicationStatus === 'draft') {
          setError('No tienes acceso a esta reunion.');
          return;
        }

        setMeeting(doc);
      })
      .catch((requestError) => setError(formatFirestoreError(requestError)))
      .finally(() => setLoading(false));
  }, [congregationId, id, isAdminOrSupervisor, loadingProfile, profileError]);

  const sections = useMemo(() => (meeting ? buildMeetingProgramFromMeeting(meeting) : []), [meeting]);
  const weekendSessions = useMemo(
    () => extractWeekendSessionsFromSections(sections),
    [sections]
  );

  const zoomFields = useMemo(() => getZoomFieldsFromSections(sections), [sections]);

  const zoomSummary = useMemo(() => {
    const values = [
      zoomFields.zoomMeetingId ? `ID: ${zoomFields.zoomMeetingId}` : undefined,
      zoomFields.zoomPasscode ? `Codigo: ${zoomFields.zoomPasscode}` : undefined,
      zoomFields.zoomLink ? `Enlace: ${zoomFields.zoomLink}` : undefined,
    ].filter((item): item is string => Boolean(item));

    return values.join('\n');
  }, [zoomFields.zoomLink, zoomFields.zoomMeetingId, zoomFields.zoomPasscode]);

  const copyZoomData = async () => {
    if (!zoomSummary) {
      Alert.alert('Zoom', 'No hay datos de Zoom para copiar.');
      return;
    }

    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(zoomSummary);
        Alert.alert('Zoom', 'Datos de Zoom copiados al portapapeles.');
        return;
      }

      await Share.share({ message: zoomSummary });
    } catch (requestError) {
      Alert.alert('Error', formatFirestoreError(requestError));
    }
  };

  const requestDeleteMeeting = () => {
    if (!meeting || !congregationId || deleting) return;

    Alert.alert(
      'Eliminar reunion',
      'Esta accion eliminara la reunion de forma permanente. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void executeDeleteMeeting();
          },
        },
      ]
    );
  };

  const executeDeleteMeeting = async () => {
    if (!meeting || !congregationId) return;

    setDeleting(true);

    try {
      await deleteMeeting(congregationId, meeting.id);
      router.replace('/(protected)/meetings/manage' as never);
    } catch (requestError) {
      Alert.alert('Error', formatFirestoreError(requestError));
    } finally {
      setDeleting(false);
    }
  };

  if (loading || loadingProfile) return <LoadingState message="Cargando reunion..." />;
  if (error || !meeting) return <ErrorState message={error ?? 'Reunion no encontrada.'} />;

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <PageHeader
        title={meeting.type === 'midweek' ? 'Reunion Vida y Ministerio Cristianos' : 'Reunion del fin de semana'}
        showBack
        actions={
          isAdminOrSupervisor ? (
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.editBtn} onPress={() => router.push(`/(protected)/meetings/edit/${meeting.id}` as never)}>
                <Ionicons name="pencil-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteBtn, deleting && styles.dim]}
                onPress={requestDeleteMeeting}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                )}
              </TouchableOpacity>
            </View>
          ) : undefined
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerWrap}>
          <ThemedText style={styles.headerDate}>{formatDate(meeting.meetingDate ?? meeting.startDate)}</ThemedText>
          <ThemedText style={styles.headerType}>{meeting.type === 'midweek' ? 'Entre semana' : 'Fin de semana'}</ThemedText>
        </View>

        {(meeting.type === 'midweek' || meeting.meetingCategory === 'midweek') ? (
          sections.filter((section) => section.isEnabled !== false).map((section) => {
            const sectionColor = section.colorToken ? SECTION_COLOR_MAP[section.colorToken] : colors.secondary;

            return (
              <View key={section.sectionKey} style={styles.sectionCard}>
                <View style={[styles.sectionBanner, { backgroundColor: sectionColor }]}>
                  <ThemedText style={styles.sectionBannerText}>{section.title}</ThemedText>
                </View>

                <View style={styles.sectionBody}>
                  {section.assignments.length === 0 ? (
                    <ThemedText style={styles.emptyLine}>No disponible</ThemedText>
                  ) : (
                    section.assignments.map((assignment) => {
                      const names = assignment.assignees
                        .map((assignee) => normalizeText(assignee.assigneeNameSnapshot))
                        .filter((name): name is string => Boolean(name));

                      const themeLabel = normalizeText(assignment.roleLabel);
                      const durationLabel =
                        typeof assignment.durationMinutes === 'number' && Number.isFinite(assignment.durationMinutes)
                          ? `${assignment.durationMinutes} min.`
                          : undefined;

                      return (
                        <View key={assignment.assignmentKey} style={styles.assignmentWrap}>
                          <ThemedText style={styles.assignmentTitle}>{assignment.title}</ThemedText>
                          {themeLabel ? <ThemedText style={styles.assignmentMeta}>Tema: {themeLabel}</ThemedText> : null}
                          {durationLabel ? <ThemedText style={styles.assignmentMeta}>Duracion: {durationLabel}</ThemedText> : null}
                          <ThemedText style={styles.assignmentName}>
                            {names.length > 0
                              ? names.join(', ')
                              : assignment.assignmentScope === 'internal'
                                ? 'Ninguno'
                                : 'No disponible'}
                          </ThemedText>
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            );
          })
        ) : (
          weekendSessions.map((session, index) => (
            <View key={session.id} style={styles.sectionCard}>
              <View style={[styles.sectionBanner, { backgroundColor: colors.primary }]}>
                <ThemedText style={styles.sectionBannerText}>Sesion {index + 1}</ThemedText>
              </View>

              <View style={styles.sectionBody}>
                <View style={styles.assignmentWrap}>
                  <ThemedText style={styles.assignmentTitle}>Discurso Publico</ThemedText>
                  <ThemedText style={styles.assignmentName}>
                    {normalizeText(session.publicTalk.discourseTitle) ?? 'Sin tema'}
                  </ThemedText>
                  <ThemedText style={styles.assignmentMeta}>
                    Asignado: {getWeekendSpeakerDisplayName(session.publicTalk.speaker)}
                  </ThemedText>
                </View>

                <View style={styles.assignmentWrap}>
                  <ThemedText style={styles.assignmentTitle}>Estudio de La Atalaya</ThemedText>
                  <ThemedText style={styles.assignmentName}>
                    {normalizeText(session.watchtowerStudy.theme) ?? 'Sin tema'}
                  </ThemedText>
                  <ThemedText style={styles.assignmentMeta}>
                    Conductor: {getWeekendRegisteredDisplayName(session.watchtowerStudy.conductor)}
                  </ThemedText>
                  <ThemedText style={styles.assignmentMeta}>
                    Lector: {getWeekendRegisteredDisplayName(session.watchtowerStudy.reader)}
                  </ThemedText>
                </View>
              </View>
            </View>
          ))
        )}

        {(zoomFields.zoomLink || zoomFields.zoomMeetingId || zoomFields.zoomPasscode) ? (
          <TouchableOpacity style={styles.zoomCopyBtn} onPress={copyZoomData} activeOpacity={0.8}>
            <Ionicons name="copy-outline" size={16} color={colors.infoDark} />
            <ThemedText style={styles.zoomCopyText}>Copiar datos de Zoom</ThemedText>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    content: { padding: 14, paddingBottom: 28, gap: 12 },
    headerWrap: { paddingHorizontal: 4, gap: 2, alignItems: 'center' },
    headerDate: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, textTransform: 'capitalize' },
    headerType: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
    sectionCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, overflow: 'hidden' },
    sectionBanner: { paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center' },
    sectionBannerText: { color: '#fff', fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
    sectionBody: { padding: 12, gap: 10 },
    assignmentWrap: { gap: 2 },
    assignmentTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
    assignmentMeta: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
    assignmentName: { fontSize: 14, color: colors.textPrimary },
    emptyLine: { fontSize: 14, color: colors.textMuted },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    editBtn: { padding: 8, borderRadius: 8, backgroundColor: colors.primary + '18' },
    deleteBtn: { padding: 8, borderRadius: 8, backgroundColor: colors.error + '16' },
    zoomCopyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.info + '66', borderRadius: 10, backgroundColor: colors.infoLight, paddingVertical: 10, marginTop: 4 },
    zoomCopyText: { color: colors.infoDark, fontWeight: '700', fontSize: 13 },
    dim: { opacity: 0.55 },
  });
