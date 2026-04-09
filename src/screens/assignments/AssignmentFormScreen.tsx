import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { LoadingState } from '@/src/components/common/LoadingState';
import { ThemedText } from '@/src/components/themed-text';
import { AppColors } from '@/src/constants/app-colors';
import { getAssignmentById, createAssignment, updateAssignment } from '@/src/services/assignments/assignments-service';
import { AssignmentPriority, ASSIGNMENT_PRIORITY_LABELS, UpdateAssignmentDTO } from '@/src/types/assignment';
import { validateRequired, hasErrors } from '@/src/utils/validation/validation';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { priorityColor } from '@/src/components/common/StatusBadge';
import { useUser } from '@/src/context/user-context';
import { useAuth } from '@/src/context/auth-context';

type Mode = 'create' | 'edit';

export function AssignmentFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { appUser } = useUser();
  const { user } = useAuth();
  const mode: Mode = id ? 'edit' : 'create';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<AssignmentPriority>('medium');
  const [assignedToName, setAssignedToName] = useState('');
  const [assignedToUid, setAssignedToUid] = useState('');
  const [errors, setErrors] = useState<{ title?: string }>({});
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && id) {
      getAssignmentById(id)
        .then((a) => {
          if (a) {
            setTitle(a.title);
            setDescription(a.description ?? '');
            setPriority(a.priority);
            setAssignedToName(a.assignedToName);
            setAssignedToUid(a.assignedToUid);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [id, mode]);

  const validate = () => {
    const e = { title: validateRequired(title, 'El título') };
    setErrors(e);
    return !hasErrors(e);
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const dueDate = Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000); // +7 días por defecto

      if (mode === 'create') {
        await createAssignment(
          {
            title,
            description,
            priority,
            assignedToUid: assignedToUid || (user?.uid ?? ''),
            assignedToName: assignedToName || (appUser?.displayName ?? 'Sin asignar'),
            dueDate,
          },
          user?.uid ?? '',
          appUser?.displayName ?? user?.email ?? 'Sistema'
        );
        Alert.alert('Éxito', 'Asignación creada correctamente.');
      } else if (id) {
        const data: UpdateAssignmentDTO = { title, description, priority };
        await updateAssignment(id, data);
        Alert.alert('Éxito', 'Asignación actualizada.');
      }
      router.back();
    } catch (e) {
      Alert.alert('Error', formatFirestoreError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  const priorities: AssignmentPriority[] = ['low', 'medium', 'high', 'critical'];

  return (
    <ScreenContainer scrollable={false}>
      <PageHeader
        title={mode === 'create' ? 'Nueva asignación' : 'Editar asignación'}
        showBack
      />
      <ScrollView contentContainerStyle={styles.form}>
        <Field label="Título *" error={errors.title}>
          <TextInput
            style={[styles.input, errors.title && styles.inputError]}
            value={title}
            onChangeText={setTitle}
            placeholder="Ej: Preparar informe mensual"
            placeholderTextColor={AppColors.textDisabled}
          />
        </Field>

        <Field label="Descripción">
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Detalles de la tarea..."
            placeholderTextColor={AppColors.textDisabled}
            multiline
            numberOfLines={4}
          />
        </Field>

        <Field label="Prioridad">
          <View style={styles.chipRow}>
            {priorities.map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.chip,
                  priority === p && { backgroundColor: priorityColor[p], borderColor: priorityColor[p] },
                ]}
                onPress={() => setPriority(p)}
                activeOpacity={0.8}
              >
                <ThemedText
                  style={[styles.chipText, priority === p && styles.chipTextActive]}
                >
                  {ASSIGNMENT_PRIORITY_LABELS[p]}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        {mode === 'create' && (
          <Field label="Asignar a (nombre)">
            <TextInput
              style={styles.input}
              value={assignedToName}
              onChangeText={setAssignedToName}
              placeholder="Nombre del responsable"
              placeholderTextColor={AppColors.textDisabled}
            />
          </Field>
        )}

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.disabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.saveButtonText}>
              {mode === 'create' ? 'Crear asignación' : 'Guardar cambios'}
            </ThemedText>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldWrap}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      {children}
      {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { padding: 16, gap: 20, paddingBottom: 32 },
  fieldWrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: AppColors.textSecondary },
  input: {
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: AppColors.textPrimary,
  },
  textarea: { minHeight: 96, textAlignVertical: 'top' },
  inputError: { borderColor: AppColors.error },
  errorText: { color: AppColors.error, fontSize: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: AppColors.textMuted },
  chipTextActive: { color: '#fff' },
  saveButton: {
    backgroundColor: AppColors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  disabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
