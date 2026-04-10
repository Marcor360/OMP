import React, { useEffect, useMemo, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';

import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useAuth } from '@/src/context/auth-context';
import { useUser } from '@/src/context/user-context';
import {
  createMeeting,
  getMeetingById,
  updateMeeting,
} from '@/src/services/meetings/meetings-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { MeetingType, MEETING_TYPE_LABELS, UpdateMeetingDTO } from '@/src/types/meeting';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { hasErrors, validateRequired } from '@/src/utils/validation/validation';

type Mode = 'create' | 'edit';

const MEETING_TYPE_OPTIONS: MeetingType[] = ['midweek', 'weekend'];

export function MeetingFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { appUser, congregationId, isAdminOrSupervisor, loadingProfile, profileError } = useUser();
  const colors = useAppColors();
  const styles = createStyles(colors);

  const mode: Mode = id ? 'edit' : 'create';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<MeetingType>('weekend');
  const [location, setLocation] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [chairman, setChairman] = useState('');
  const [openingSong, setOpeningSong] = useState('');
  const [openingPrayer, setOpeningPrayer] = useState('');
  const [closingSong, setClosingSong] = useState('');
  const [closingPrayer, setClosingPrayer] = useState('');
  const [notes, setNotes] = useState('');

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
        setType(meeting.type === 'midweek' ? 'midweek' : 'weekend');
        setLocation(meeting.location ?? '');
        setMeetingUrl(meeting.meetingUrl ?? '');
        setChairman(meeting.chairman ?? '');
        setOpeningSong(meeting.openingSong ?? '');
        setOpeningPrayer(meeting.openingPrayer ?? '');
        setClosingSong(meeting.closingSong ?? '');
        setClosingPrayer(meeting.closingPrayer ?? '');
        setNotes(meeting.notes ?? '');
      })
      .catch((requestError) => {
        Alert.alert('Error', formatFirestoreError(requestError));
        router.back();
      })
      .finally(() => setLoading(false));
  }, [congregationId, id, loadingProfile, mode, router]);

  const isMidweek = type === 'midweek';

  const saveButtonText = useMemo(() => {
    if (isMidweek) {
      return 'Abrir formulario completo de entre semana';
    }

    return mode === 'create' ? 'Crear reunion' : 'Guardar cambios';
  }, [isMidweek, mode]);

  const validate = () => {
    const nextErrors = { title: validateRequired(title, 'El titulo') };
    setErrors(nextErrors);
    return !hasErrors(nextErrors);
  };

  const openMidweekForm = () => {
    if (mode === 'edit' && id) {
      router.push(`/(protected)/meetings/midweek/${id}` as never);
      return;
    }

    router.push('/(protected)/meetings/midweek/create');
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

    if (isMidweek) {
      Alert.alert(
        'Reunion entre semana',
        'Abre el formulario especializado para capturar secciones, partes y asignados.'
      );
      openMidweekForm();
      return;
    }

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
            type: 'weekend',
            meetingCategory: 'general',
            location,
            meetingUrl,
            chairman,
            openingSong,
            openingPrayer,
            closingSong,
            closingPrayer,
            notes,
            startDate: now,
            endDate: oneHour,
            attendees: user?.uid ? [user.uid] : [],
          },
          user?.uid ?? '',
          appUser?.displayName ?? user?.email ?? 'Usuario'
        );

        Alert.alert('Exito', 'Reunion creada correctamente.');
      } else if (id) {
        const payload: UpdateMeetingDTO = {
          title,
          description,
          type: 'weekend',
          meetingCategory: 'general',
          location,
          meetingUrl,
          chairman,
          openingSong,
          openingPrayer,
          closingSong,
          closingPrayer,
          notes,
        };
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

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <PageHeader title={mode === 'create' ? 'Nueva reunion' : 'Editar reunion'} showBack />
      <ScrollView
        contentContainerStyle={styles.form}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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
            placeholder="Ej: Reunion semanal"
            placeholderTextColor={colors.textDisabled}
            editable={isAdminOrSupervisor}
          />
        </Field>

        <Field label="Descripcion">
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Objetivos y agenda de la reunion..."
            placeholderTextColor={colors.textDisabled}
            multiline
            numberOfLines={4}
            editable={isAdminOrSupervisor}
          />
        </Field>

        <Field label="Tipo de reunion">
          <View style={styles.chipRow}>
            {MEETING_TYPE_OPTIONS.map((meetingType) => (
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

        {isMidweek ? (
          <View style={styles.midweekBox}>
            <ThemedText style={styles.midweekTitle}>Datos que lleva la reunion de entre semana</ThemedText>
            <ThemedText style={styles.midweekItem}>- Semana y lectura biblica</ThemedText>
            <ThemedText style={styles.midweekItem}>- Presidente, canciones y oraciones</ThemedText>
            <ThemedText style={styles.midweekItem}>- 3 secciones fijas con partes dinamicas</ThemedText>
            <ThemedText style={styles.midweekItem}>- Asignados por usuario o nombre manual</ThemedText>

            <TouchableOpacity style={styles.midweekButton} onPress={openMidweekForm} activeOpacity={0.8}>
              <Ionicons name="open-outline" size={16} color="#fff" />
              <ThemedText style={styles.midweekButtonText}>Abrir formulario de entre semana</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.midweekImportButton}
              onPress={() => router.push('/(protected)/meetings/midweek' as never)}
              activeOpacity={0.8}
            >
              <Ionicons name="document-attach-outline" size={16} color={colors.infoDark} />
              <ThemedText style={styles.midweekImportButtonText}>Ir a Importar PDF</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Field label="Lugar / Sala">
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="Ej: Salon principal"
                placeholderTextColor={colors.textDisabled}
                editable={isAdminOrSupervisor}
              />
            </Field>

            <Field label="Enlace de reunion">
              <TextInput
                style={styles.input}
                value={meetingUrl}
                onChangeText={setMeetingUrl}
                placeholder="https://meet.google.com/..."
                placeholderTextColor={colors.textDisabled}
                keyboardType="url"
                autoCapitalize="none"
                editable={isAdminOrSupervisor}
              />
            </Field>

            <Field label="Presidente">
              <TextInput
                style={styles.input}
                value={chairman}
                onChangeText={setChairman}
                placeholder="Nombre del presidente"
                placeholderTextColor={colors.textDisabled}
                editable={isAdminOrSupervisor}
              />
            </Field>

            <View style={styles.inlineRow}>
              <View style={styles.inlineField}>
                <Field label="Cancion inicial">
                  <TextInput
                    style={styles.input}
                    value={openingSong}
                    onChangeText={setOpeningSong}
                    placeholder="Ej: Cancion 25"
                    placeholderTextColor={colors.textDisabled}
                    editable={isAdminOrSupervisor}
                  />
                </Field>
              </View>

              <View style={styles.inlineField}>
                <Field label="Oracion inicial">
                  <TextInput
                    style={styles.input}
                    value={openingPrayer}
                    onChangeText={setOpeningPrayer}
                    placeholder="Asignado"
                    placeholderTextColor={colors.textDisabled}
                    editable={isAdminOrSupervisor}
                  />
                </Field>
              </View>
            </View>

            <View style={styles.inlineRow}>
              <View style={styles.inlineField}>
                <Field label="Cancion final">
                  <TextInput
                    style={styles.input}
                    value={closingSong}
                    onChangeText={setClosingSong}
                    placeholder="Ej: Cancion 54"
                    placeholderTextColor={colors.textDisabled}
                    editable={isAdminOrSupervisor}
                  />
                </Field>
              </View>

              <View style={styles.inlineField}>
                <Field label="Oracion final">
                  <TextInput
                    style={styles.input}
                    value={closingPrayer}
                    onChangeText={setClosingPrayer}
                    placeholder="Asignado"
                    placeholderTextColor={colors.textDisabled}
                    editable={isAdminOrSupervisor}
                  />
                </Field>
              </View>
            </View>

            <Field label="Notas">
              <TextInput
                style={[styles.input, styles.textarea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Tema publico, lector, observaciones..."
                placeholderTextColor={colors.textDisabled}
                multiline
                numberOfLines={4}
                editable={isAdminOrSupervisor}
              />
            </Field>
          </>
        )}

        <TouchableOpacity
          style={[styles.saveButton, (saving || !isAdminOrSupervisor) && styles.disabled]}
          onPress={handleSave}
          disabled={saving || !isAdminOrSupervisor}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.saveButtonText}>{saveButtonText}</ThemedText>
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
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.fieldWrap}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      {children}
      {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    form: { padding: 16, gap: 20, paddingBottom: 32 },
    fieldWrap: { gap: 6 },
    label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      color: colors.textPrimary,
    },
    textarea: { minHeight: 96, textAlignVertical: 'top' },
    inputError: { borderColor: colors.error },
    errorText: { color: colors.error, fontSize: 12 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
    chipTextActive: { color: '#fff' },
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    disabled: { opacity: 0.6 },
    saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 15, textAlign: 'center' },
    permissionNotice: {
      borderWidth: 1,
      borderColor: colors.warning + '66',
      backgroundColor: colors.warning + '20',
      borderRadius: 10,
      padding: 12,
    },
    permissionText: {
      fontSize: 13,
      color: colors.warning,
      fontWeight: '600',
    },
    midweekBox: {
      borderWidth: 1,
      borderColor: colors.info + '55',
      backgroundColor: colors.infoLight,
      borderRadius: 10,
      padding: 12,
      gap: 6,
    },
    midweekTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.infoDark,
      marginBottom: 4,
    },
    midweekItem: {
      fontSize: 13,
      color: colors.infoDark,
    },
    midweekButton: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.info,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    midweekButtonText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
    },
    midweekImportButton: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.infoLight,
      borderWidth: 1,
      borderColor: colors.info + '55',
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    midweekImportButtonText: {
      color: colors.infoDark,
      fontSize: 13,
      fontWeight: '700',
    },
    inlineRow: {
      flexDirection: 'row',
      gap: 10,
    },
    inlineField: {
      flex: 1,
    },
  });
