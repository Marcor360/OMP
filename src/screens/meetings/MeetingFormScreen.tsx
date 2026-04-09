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
import { getMeetingById, createMeeting, updateMeeting } from '@/src/services/meetings/meetings-service';
import { MeetingType, MEETING_TYPE_LABELS, UpdateMeetingDTO } from '@/src/types/meeting';
import { validateRequired, hasErrors } from '@/src/utils/validation/validation';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { useUser } from '@/src/context/user-context';
import { useAuth } from '@/src/context/auth-context';

type Mode = 'create' | 'edit';

export function MeetingFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { appUser } = useUser();
  const { user } = useAuth();
  const mode: Mode = id ? 'edit' : 'create';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<MeetingType>('internal');
  const [location, setLocation] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [errors, setErrors] = useState<{ title?: string }>({});
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && id) {
      getMeetingById(id)
        .then((m) => {
          if (m) {
            setTitle(m.title);
            setDescription(m.description ?? '');
            setType(m.type);
            setLocation(m.location ?? '');
            setMeetingUrl(m.meetingUrl ?? '');
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
      const now = Timestamp.now();
      const oneHour = Timestamp.fromMillis(now.toMillis() + 60 * 60 * 1000);

      if (mode === 'create') {
        await createMeeting(
          { title, description, type, location, meetingUrl, startDate: now, endDate: oneHour, attendees: [user?.uid ?? ''] },
          user?.uid ?? '',
          appUser?.displayName ?? user?.email ?? 'Usuario'
        );
        Alert.alert('Éxito', 'Reunión creada correctamente.');
      } else if (id) {
        const data: UpdateMeetingDTO = { title, description, type, location, meetingUrl };
        await updateMeeting(id, data);
        Alert.alert('Éxito', 'Reunión actualizada.');
      }
      router.back();
    } catch (e) {
      Alert.alert('Error', formatFirestoreError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  const types: MeetingType[] = ['internal', 'external', 'review', 'training'];

  return (
    <ScreenContainer scrollable={false}>
      <PageHeader
        title={mode === 'create' ? 'Nueva reunión' : 'Editar reunión'}
        showBack
      />
      <ScrollView contentContainerStyle={styles.form}>
        <Field label="Título *" error={errors.title}>
          <TextInput
            style={[styles.input, errors.title && styles.inputError]}
            value={title}
            onChangeText={setTitle}
            placeholder="Ej: Revisión semanal de proyectos"
            placeholderTextColor={AppColors.textDisabled}
          />
        </Field>

        <Field label="Descripción">
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Objetivos y agenda de la reunión..."
            placeholderTextColor={AppColors.textDisabled}
            multiline
            numberOfLines={4}
          />
        </Field>

        <Field label="Tipo de reunión">
          <View style={styles.chipRow}>
            {types.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, type === t && styles.chipActive]}
                onPress={() => setType(t)}
                activeOpacity={0.8}
              >
                <ThemedText style={[styles.chipText, type === t && styles.chipTextActive]}>
                  {MEETING_TYPE_LABELS[t]}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field label="Lugar / Sala">
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="Ej: Sala de juntas A"
            placeholderTextColor={AppColors.textDisabled}
          />
        </Field>

        <Field label="Enlace de reunión">
          <TextInput
            style={styles.input}
            value={meetingUrl}
            onChangeText={setMeetingUrl}
            placeholder="https://meet.google.com/..."
            placeholderTextColor={AppColors.textDisabled}
            keyboardType="url"
            autoCapitalize="none"
          />
        </Field>

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
              {mode === 'create' ? 'Crear reunión' : 'Guardar cambios'}
            </ThemedText>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
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
  chipActive: { backgroundColor: AppColors.primary, borderColor: AppColors.primary },
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
