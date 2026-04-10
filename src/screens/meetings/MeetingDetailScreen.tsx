import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AssignmentCard } from '@/src/components/cards/AssignmentCard';
import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { RoleGuard } from '@/src/components/common/RoleGuard';
import { StatusBadge, meetingStatusColor } from '@/src/components/common/StatusBadge';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import { getAssignmentsByMeeting } from '@/src/services/assignments/assignments-service';
import { deleteMeeting, getMeetingById } from '@/src/services/meetings/meetings-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { Assignment } from '@/src/types/assignment';
import { Meeting, MEETING_STATUS_LABELS, MEETING_TYPE_LABELS } from '@/src/types/meeting';
import { formatDate, formatTime } from '@/src/utils/dates/dates';
import { formatFirestoreError } from '@/src/utils/errors/errors';

export function MeetingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { congregationId, loadingProfile, profileError } = useUser();
  const colors = useAppColors();
  const styles = createStyles(colors);

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loadingProfile) return;

    if (!id || !congregationId) {
      setError(profileError ?? 'No se encontro la congregacion del usuario actual.');
      setLoading(false);
      return;
    }

    Promise.all([getMeetingById(congregationId, id), getAssignmentsByMeeting(congregationId, id)])
      .then(([meetingDoc, assignmentDocs]) => {
        setMeeting(meetingDoc);
        setAssignments(assignmentDocs);

        if (!meetingDoc) {
          setError('Reunion no encontrada.');
        }
      })
      .catch((requestError) => {
        setError(formatFirestoreError(requestError));
      })
      .finally(() => setLoading(false));
  }, [congregationId, id, loadingProfile, profileError]);

  const handleDelete = async () => {
    if (!meeting || !congregationId) return;

    const confirmed =
      Platform.OS === 'web'
        ? window.confirm('Eliminar esta reunion?')
        : await new Promise<boolean>((resolve) =>
            Alert.alert('Eliminar reunion', 'Estas seguro?', [
              { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Eliminar', style: 'destructive', onPress: () => resolve(true) },
            ])
          );

    if (!confirmed) return;

    try {
      await deleteMeeting(congregationId, meeting.id);
      router.back();
    } catch (requestError) {
      Alert.alert('Error', formatFirestoreError(requestError));
    }
  };

  if (loading || loadingProfile) return <LoadingState />;
  if (error || !meeting) return <ErrorState message={error ?? 'Reunion no encontrada.'} />;

  return (
    <ScreenContainer scrollable={false}>
      <PageHeader
        title="Detalle de reunion"
        showBack
        actions={
          <RoleGuard allowedRoles={['admin', 'supervisor']}>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => router.push(`/(protected)/meetings/edit/${meeting.id}` as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="pencil-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          </RoleGuard>
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleSection}>
          <StatusBadge label={MEETING_STATUS_LABELS[meeting.status]} color={meetingStatusColor[meeting.status]} />
          <ThemedText style={styles.title}>{meeting.title}</ThemedText>
          <ThemedText style={styles.type}>{MEETING_TYPE_LABELS[meeting.type]}</ThemedText>
        </View>

        <View style={styles.card}>
          <InfoRow icon="calendar-outline" label="Fecha" value={formatDate(meeting.startDate)} />
          <InfoRow icon="time-outline" label="Horario" value={`${formatTime(meeting.startDate)} - ${formatTime(meeting.endDate)}`} />
          {meeting.location ? <InfoRow icon="location-outline" label="Lugar" value={meeting.location} /> : null}
          {meeting.meetingUrl ? <InfoRow icon="link-outline" label="Enlace" value={meeting.meetingUrl} /> : null}
          <InfoRow icon="person-outline" label="Organizador" value={meeting.organizerName} />
          <InfoRow
            icon="people-outline"
            label="Asistentes"
            value={`${meeting.attendees.length} persona${meeting.attendees.length !== 1 ? 's' : ''}`}
          />
        </View>

        {meeting.description ? (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Descripcion</ThemedText>
            <ThemedText style={styles.description}>{meeting.description}</ThemedText>
          </View>
        ) : null}

        {meeting.notes ? (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Notas</ThemedText>
            <ThemedText style={styles.description}>{meeting.notes}</ThemedText>
          </View>
        ) : null}

        {assignments.length > 0 ? (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Asignaciones vinculadas ({assignments.length})</ThemedText>
            <View style={styles.assignmentList}>
              {assignments.map((assignment) => (
                <AssignmentCard key={assignment.id} assignment={assignment} />
              ))}
            </View>
          </View>
        ) : null}

        <RoleGuard allowedRoles={['admin', 'supervisor']}>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <ThemedText style={styles.deleteBtnText}>Eliminar reunion</ThemedText>
          </TouchableOpacity>
        </RoleGuard>
      </ScrollView>
    </ScreenContainer>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <ThemedText style={styles.infoLabel}>{label}</ThemedText>
      <ThemedText style={styles.infoValue} numberOfLines={2}>
        {value}
      </ThemedText>
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    content: { padding: 16, gap: 16, paddingBottom: 32 },
    titleSection: { gap: 6 },
    title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, lineHeight: 28 },
    type: { fontSize: 13, color: colors.textMuted },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    infoLabel: { fontSize: 13, color: colors.textMuted, width: 100 },
    infoValue: { flex: 1, fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
    section: { gap: 10 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
    description: { fontSize: 14, color: colors.textMuted, lineHeight: 22 },
    assignmentList: { gap: 10 },
    editBtn: { padding: 8, backgroundColor: colors.primary + '22', borderRadius: 8 },
    deleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.error + '44',
      backgroundColor: colors.error + '11',
      marginTop: 8,
    },
    deleteBtnText: { color: colors.error, fontWeight: '600' },
  });
