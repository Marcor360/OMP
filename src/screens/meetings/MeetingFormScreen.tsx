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

import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { AppColors } from '@/src/constants/app-colors';
import { useAuth } from '@/src/context/auth-context';
import { useUser } from '@/src/context/user-context';
import { createMeeting, getMeetingById, updateMeeting } from '@/src/services/meetings/meetings-service';
import { MeetingType, MEETING_TYPE_LABELS, UpdateMeetingDTO } from '@/src/types/meeting';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { hasErrors, validateRequired } from '@/src/utils/validation/validation';

type Mode = 'create' | 'edit';

export function MeetingFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { appUser, congregationId, isAdminOrSupervisor, loadingProfile, profileError } = useUser();

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
    if (mode !== 'edit') {
      setLoading(false);
      return;
    }

    if (!id || !congregationId || loadingProfile) {
      return;
    }

    getMeetingById(congregationId, id)
      .then((meeting) => {
        if (!meeting) {
          Alert.alert('Error', 'No se encontro la reunion.');
          router.back();
          return;
        }

        setTitle(meeting.title);
        setDescription(meeting.description ?? '');
        setType(meeting.type);
        setLocation(meeting.location ?? '');
        setMeetingUrl(meeting.meetingUrl ?? '');
      })
      .catch((requestError) => {
        Alert.alert('Error', formatFirestoreError(requestError));
        router.back();
      })
      .finally(() => setLoading(false));
  }, [congregationId, id, loadingProfile, mode, router]);

  const validate = () => {
    const nextErrors = { title: validateRequired(title, 'El titulo') };
    setErrors(nextErrors);
    return !hasErrors(nextErrors);
  };

  const handleSave = async () => {
    if (!isAdminOrSupervisor) {
      Alert.alert('Permisos insuficientes', 'No tienes permisos para crear o editar reuniones.');
      return;
    }

    if (!congregationId) {
      Alert.alert('Error', profileError ?? 'No se encontro la congregacion del usuario actual.');
      return;
    }

    if (!validate()) return;

    setSaving(true);

    try {
      const now = Timestamp.now();
      const oneHour = Timestamp.fromMillis(now.toMillis() + 60 * 60 * 1000);

      if (mode === 'create') {
        await createMeeting(
          congregationId,
          {
            title,
            description,
            type,
            location,
            meetingUrl,
            startDate: now,
            endDate: oneHour,
            attendees: user?.uid ? [user.uid] : [],
          },
          user?.uid ?? '',
          appUser?.displayName ?? user?.email ?? 'Usuario'
        );

        Alert.alert('Exito', 'Reunion creada correctamente.');
      } else if (id) {
        const payload: UpdateMeetingDTO = { title, description, type, location, meetingUrl };
        await updateMeeting(congregationId, id, payload);
        Alert.alert('Exito', 'Reunion actualizada.');
      }

      router.back();
    } catch (requestError) {
      Alert.alert('Error', formatFirestoreError(requestError));
    } finally {
      setSaving(false);
    }
  };

  if (loading || loadingProfile) return <LoadingState />;

  const meetingTypes: MeetingType[] = ['internal', 'external', 'review', 'training'];

  return (
    <ScreenContainer scrollable={false}>
      <PageHeader
        title={mode === 'create' ? 'Nueva reunion' : 'Editar reunion'}
        showBack
      />
      <ScrollView contentContainerStyle={styles.form}>
        {!isAdminOrSupervisor ? (
          <View style={styles.permissionNotice}>
            <ThemedText style={styles.permissionText}>
              No tienes permisos para guardar cambios en reuniones.
            </ThemedText>
          </View>
        ) : null}

        <Field label="Titulo *" error={errors.title}>
          <TextInput
            style={[styles.input, errors.title && styles.inputError]}
            value={title}
            onChangeText={setTitle}
            placeholder="Ej: Revision semanal de proyectos"
            placeholderTextColor={AppColors.textDisabled}
            editable={isAdminOrSupervisor}
          />
        </Field>

        <Field label="Descripcion">
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Objetivos y agenda de la reunion..."
            placeholderTextColor={AppColors.textDisabled}
            multiline
            numberOfLines={4}
            editable={isAdminOrSupervisor}
          />
        </Field>

        <Field label="Tipo de reunion">
          <View style={styles.chipRow}>
            {meetingTypes.map((meetingType) => (
              <TouchableOpacity
                key={meetingType}
                style={[styles.chip, type === meetingType && styles.chipActive]}
                onPress={() => setType(meetingType)}
                activeOpacity={0.8}
                disabled={!isAdminOrSupervisor}
              >
                <ThemedText style={[styles.chipText, type === meetingType && styles.chipTextActive]}>
                  {MEETING_TYPE_LABELS[meetingType]}
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
            editable={isAdminOrSupervisor}
          />
        </Field>

        <Field label="Enlace de reunion">
          <TextInput
            style={styles.input}
            value={meetingUrl}
            onChangeText={setMeetingUrl}
            placeholder="https://meet.google.com/..."
            placeholderTextColor={AppColors.textDisabled}
            keyboardType="url"
            autoCapitalize="none"
            editable={isAdminOrSupervisor}
          />
        </Field>

        <TouchableOpacity
          style={[styles.saveButton, (saving || !isAdminOrSupervisor) && styles.disabled]}
          onPress={handleSave}
          disabled={saving || !isAdminOrSupervisor}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.saveButtonText}>
              {mode === 'create' ? 'Crear reunion' : 'Guardar cambios'}
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
  permissionNotice: {
    borderWidth: 1,
    borderColor: AppColors.warning + '66',
    backgroundColor: AppColors.warning + '20',
    borderRadius: 10,
    padding: 12,
  },
  permissionText: {
    fontSize: 13,
    color: AppColors.warning,
    fontWeight: '600',
  },
});