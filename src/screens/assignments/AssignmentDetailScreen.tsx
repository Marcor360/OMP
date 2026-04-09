import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { LoadingState } from '@/src/components/common/LoadingState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { StatusBadge, assignmentStatusColor, priorityColor } from '@/src/components/common/StatusBadge';
import { RoleGuard } from '@/src/components/common/RoleGuard';
import { ThemedText } from '@/src/components/themed-text';
import { AppColors } from '@/src/constants/app-colors';
import { getAssignmentById, updateAssignment, deleteAssignment } from '@/src/services/assignments/assignments-service';
import {
  Assignment,
  AssignmentStatus,
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_PRIORITY_LABELS,
} from '@/src/types/assignment';
import { formatDate, formatDateTime, isOverdue } from '@/src/utils/dates/dates';
import { formatFirestoreError } from '@/src/utils/errors/errors';

const NEXT_STATUS: Partial<Record<AssignmentStatus, AssignmentStatus>> = {
  pending: 'in_progress',
  in_progress: 'completed',
};

export function AssignmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!id) return;
    getAssignmentById(id)
      .then((a) => {
        setAssignment(a);
        if (!a) setError('Asignación no encontrada.');
      })
      .catch(() => setError('Error al cargar la asignación.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAdvanceStatus = async () => {
    if (!assignment) return;
    const next = NEXT_STATUS[assignment.status];
    if (!next) return;
    setUpdating(true);
    try {
      await updateAssignment(assignment.id, { status: next });
      setAssignment((a) => (a ? { ...a, status: next } : null));
    } catch (e) {
      Alert.alert('Error', formatFirestoreError(e));
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!assignment) return;
    const confirmed =
      Platform.OS === 'web'
        ? window.confirm('¿Eliminar esta asignación?')
        : await new Promise<boolean>((resolve) =>
            Alert.alert('Eliminar', '¿Seguro?', [
              { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Eliminar', style: 'destructive', onPress: () => resolve(true) },
            ])
          );
    if (!confirmed) return;
    try {
      await deleteAssignment(assignment.id);
      router.back();
    } catch (e) {
      Alert.alert('Error', formatFirestoreError(e));
    }
  };

  if (loading) return <LoadingState />;
  if (error || !assignment)
    return <ErrorState message={error ?? 'Asignación no encontrada.'} />;

  const overdue = isOverdue(assignment.dueDate) && assignment.status === 'pending';
  const nextStatus = NEXT_STATUS[assignment.status];

  return (
    <ScreenContainer>
      <PageHeader
        title="Detalle de asignación"
        showBack
        actions={
          <RoleGuard allowedRoles={['admin', 'supervisor']}>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => router.push(`/(protected)/assignments/edit/${assignment.id}` as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="pencil-outline" size={18} color={AppColors.primary} />
            </TouchableOpacity>
          </RoleGuard>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.titleSection}>
          <View style={styles.badgeRow}>
            <StatusBadge
              label={ASSIGNMENT_STATUS_LABELS[assignment.status]}
              color={assignmentStatusColor[assignment.status]}
            />
            <StatusBadge
              label={ASSIGNMENT_PRIORITY_LABELS[assignment.priority]}
              color={priorityColor[assignment.priority]}
            />
          </View>
          <ThemedText style={styles.title}>{assignment.title}</ThemedText>
          {assignment.description ? (
            <ThemedText style={styles.description}>{assignment.description}</ThemedText>
          ) : null}
        </View>

        {/* Info */}
        <View style={styles.card}>
          <InfoRow icon="person-outline" label="Asignado a" value={assignment.assignedToName} />
          <InfoRow icon="person-add-outline" label="Asignado por" value={assignment.assignedByName} />
          <InfoRow
            icon="calendar-outline"
            label="Fecha límite"
            value={formatDate(assignment.dueDate)}
            valueStyle={overdue ? { color: AppColors.error } : undefined}
          />
          {assignment.completedAt ? (
            <InfoRow icon="checkmark-circle-outline" label="Completada" value={formatDateTime(assignment.completedAt)} />
          ) : null}
          <InfoRow icon="time-outline" label="Creada" value={formatDate(assignment.createdAt)} />
        </View>

        {/* Advance status button */}
        {nextStatus ? (
          <RoleGuard allowedRoles={['admin', 'supervisor']}>
            <TouchableOpacity
              style={styles.advanceBtn}
              onPress={handleAdvanceStatus}
              disabled={updating}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-forward-circle-outline" size={18} color={AppColors.success} />
              <ThemedText style={styles.advanceBtnText}>
                {updating ? 'Actualizando...' : `Marcar como "${ASSIGNMENT_STATUS_LABELS[nextStatus]}"`}
              </ThemedText>
            </TouchableOpacity>
          </RoleGuard>
        ) : null}

        {/* Delete */}
        <RoleGuard allowedRoles={['admin', 'supervisor']}>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
            <Ionicons name="trash-outline" size={18} color={AppColors.error} />
            <ThemedText style={styles.deleteBtnText}>Eliminar asignación</ThemedText>
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
  valueStyle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  valueStyle?: object;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={AppColors.textMuted} />
      <ThemedText style={styles.infoLabel}>{label}</ThemedText>
      <ThemedText style={[styles.infoValue, valueStyle]}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  titleSection: { gap: 8 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  title: { fontSize: 20, fontWeight: '800', color: AppColors.textPrimary, lineHeight: 26 },
  description: { fontSize: 14, color: AppColors.textMuted, lineHeight: 22 },
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  infoLabel: { fontSize: 13, color: AppColors.textMuted, width: 110 },
  infoValue: { flex: 1, fontSize: 14, color: AppColors.textPrimary, fontWeight: '500' },
  editBtn: { padding: 8, backgroundColor: AppColors.primary + '22', borderRadius: 8 },
  advanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.success + '44',
    backgroundColor: AppColors.success + '11',
  },
  advanceBtnText: { color: AppColors.success, fontWeight: '600' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.error + '44',
    backgroundColor: AppColors.error + '11',
  },
  deleteBtnText: { color: AppColors.error, fontWeight: '600' },
});
