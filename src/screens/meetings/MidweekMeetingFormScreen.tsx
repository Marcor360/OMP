import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

import { AssignmentCardEditorErrors } from '@/src/components/meetings/midweek/AssignmentCardEditor';
import { MidweekSectionEditor } from '@/src/components/meetings/midweek/MidweekSectionEditor';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useAuth } from '@/src/context/auth-context';
import { useUser } from '@/src/context/user-context';
import { useMeetingsManagementPermission } from '@/src/hooks/use-meetings-management-permission';
import {
  MidweekMeeting,
  MidweekMeetingPayload,
  createMidweekMeeting,
  getMidweekMeetingById,
  updateMidweekMeeting,
} from '@/src/services/meetings/midweek-meetings-service';
import { importMidweekMeetingsFromPdf } from '@/src/services/meetings/midweek-import-service';
import {
  ActiveCongregationUser,
  getActiveCongregationUsers,
} from '@/src/services/users/active-users-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import {
  MIDWEEK_REQUIRED_SECTION_IDS,
  MidweekMeetingSection,
  createMidweekMeetingTemplate,
  normalizeSectionOrder,
} from '@/src/types/midweek-meeting';
import { MeetingStatus, MEETING_STATUS_LABELS } from '@/src/types/meeting';
import { readDocumentPickerAssetAsBase64 } from '@/src/utils/files/document-picker';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { hasErrors, validateRequired } from '@/src/utils/validation/validation';

type Mode = 'create' | 'edit';

interface MidweekMeetingFormState {
  title: string;
  description: string;
  weekLabel: string;
  bibleReading: string;
  startDateInput: string;
  endDateInput: string;
  status: MeetingStatus;
  location: string;
  meetingUrl: string;
  notes: string;
  openingSong: string;
  openingPrayer: string;
  openingPrayerUserId: string;
  middleSong: string;
  closingSong: string;
  closingPrayer: string;
  closingPrayerUserId: string;
  chairmanUserId: string;
  chairmanName: string;
  sections: MidweekMeetingSection[];
}

interface MidweekMeetingFormErrors {
  title?: string;
  weekLabel?: string;
  bibleReading?: string;
  startDateInput?: string;
  endDateInput?: string;
  sections?: string;
  chairmanUserId?: string;
  assignments: Record<string, AssignmentCardEditorErrors>;
}

const statusOptions: MeetingStatus[] = [
  'pending',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
];

const pad = (value: number): string => String(value).padStart(2, '0');

const toInputDateTime = (value: Timestamp): string => {
  const date = value.toDate();

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const parseInputDateTime = (value: string): Date | null => {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute
  ) {
    return null;
  }

  return parsed;
};

const initialFormState = (): MidweekMeetingFormState => {
  const template = createMidweekMeetingTemplate();

  return {
    title: template.title,
    description: template.description ?? '',
    weekLabel: template.weekLabel,
    bibleReading: template.bibleReading,
    startDateInput: toInputDateTime(template.startDate),
    endDateInput: toInputDateTime(template.endDate),
    status: template.status,
    location: template.location ?? '',
    meetingUrl: template.meetingUrl ?? '',
    notes: '',
    openingSong: template.openingSong ?? '',
    openingPrayer: template.openingPrayer ?? '',
    openingPrayerUserId: '',
    middleSong: '',
    closingSong: template.closingSong ?? '',
    closingPrayer: template.closingPrayer ?? '',
    closingPrayerUserId: '',
    chairmanUserId: '',
    chairmanName: '',
    sections: normalizeSectionOrder(template.sections),
  };
};

const mapMeetingToFormState = (meeting: MidweekMeeting): MidweekMeetingFormState => ({
  title: meeting.title,
  description: meeting.description ?? '',
  weekLabel: meeting.weekLabel,
  bibleReading: meeting.bibleReading,
  startDateInput: toInputDateTime(meeting.startDate),
  endDateInput: toInputDateTime(meeting.endDate),
  status: meeting.status,
  location: meeting.location ?? '',
  meetingUrl: meeting.meetingUrl ?? '',
  notes: meeting.notes ?? '',
  openingSong: meeting.openingSong ?? '',
  openingPrayer: meeting.openingPrayer ?? '',
  openingPrayerUserId: '',
  middleSong: (meeting as any).middleSong ?? '',
  closingSong: meeting.closingSong ?? '',
  closingPrayer: meeting.closingPrayer ?? '',
  closingPrayerUserId: '',
  chairmanUserId: '',
  chairmanName: meeting.chairman ?? '',
  sections: normalizeSectionOrder(meeting.midweekSections),
});

export function MidweekMeetingFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { appUser, profileError } = useUser();
  const {
    canManage: isAdminOrSupervisor,
    congregationId,
    loading: loadingProfile,
  } = useMeetingsManagementPermission();
  const colors = useAppColors();
  const styles = createStyles(colors);

  const mode: Mode = id ? 'edit' : 'create';

  const [form, setForm] = useState<MidweekMeetingFormState>(initialFormState);
  const [availableUsers, setAvailableUsers] = useState<ActiveCongregationUser[]>([]);
  const [errors, setErrors] = useState<MidweekMeetingFormErrors>({ assignments: {} });
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [importingPdf, setImportingPdf] = useState(false);

  useEffect(() => {
    if (loadingProfile) return;

    if (!congregationId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(mode === 'edit');

        const usersPromise = getActiveCongregationUsers(congregationId);
        const meetingPromise = mode === 'edit' && id ? getMidweekMeetingById(congregationId, id) : Promise.resolve(null);

        const [users, meeting] = await Promise.all([usersPromise, meetingPromise]);

        if (cancelled) return;

        setAvailableUsers(users);

        if (mode === 'edit') {
          if (!meeting) {
            Alert.alert('Error', 'No se encontro la reunion de entre semana.');
            router.back();
            return;
          }

          setForm(mapMeetingToFormState(meeting));
        } else {
          setForm(initialFormState());
        }
      } catch (requestError) {
        if (!cancelled) {
          Alert.alert('Error', formatFirestoreError(requestError));
          router.back();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [congregationId, id, loadingProfile, mode, router]);

  const validate = (): { isValid: boolean; startDate?: Date; endDate?: Date } => {
    const topLevelErrors: MidweekMeetingFormErrors = {
      title: validateRequired(form.title, 'El titulo general'),
      weekLabel: validateRequired(form.weekLabel, 'La semana'),
      bibleReading: validateRequired(form.bibleReading, 'La lectura biblica'),
      chairmanUserId: form.chairmanUserId.trim().length === 0
        ? 'El presidente es obligatorio.'
        : undefined,
      startDateInput: undefined,
      endDateInput: undefined,
      sections: undefined,
      assignments: {},
    };

    const parsedStartDate = parseInputDateTime(form.startDateInput);
    const parsedEndDate = parseInputDateTime(form.endDateInput);

    if (!parsedStartDate) {
      topLevelErrors.startDateInput = 'Formato invalido. Usa YYYY-MM-DD HH:mm';
    }

    if (!parsedEndDate) {
      topLevelErrors.endDateInput = 'Formato invalido. Usa YYYY-MM-DD HH:mm';
    }

    if (parsedStartDate && parsedEndDate && parsedEndDate <= parsedStartDate) {
      topLevelErrors.endDateInput = 'La fecha final debe ser posterior a la inicial.';
    }

    const hasAllSections = MIDWEEK_REQUIRED_SECTION_IDS.every((sectionId) =>
      form.sections.some((section) => section.id === sectionId)
    );

    if (!hasAllSections) {
      topLevelErrors.sections = 'La estructura requiere las 3 secciones base de VyMC.';
    }

    form.sections.forEach((section) => {
      section.items.forEach((assignment) => {
        const assignmentErrors: AssignmentCardEditorErrors = {};

        if (!assignment.title || assignment.title.trim().length === 0) {
          assignmentErrors.title = 'La parte no puede guardarse sin titulo.';
        }

        if (
          assignment.durationMinutes !== undefined &&
          (!Number.isFinite(assignment.durationMinutes) || assignment.durationMinutes <= 0)
        ) {
          assignmentErrors.durationMinutes = 'La duracion debe ser numerica y mayor a 0.';
        }

        const participantErrors: Record<string, string> = {};

        assignment.participants.forEach((participant) => {
          const scope = assignment.assignmentScope ?? 'internal';

          if (participant.mode === 'manual') {
            if (!participant.displayName || participant.displayName.trim().length === 0) {
              participantErrors[participant.id] = 'El nombre manual no puede estar vacio.';
            }
            if (scope === 'internal' && participant.displayName.trim().length > 0) {
              participantErrors[participant.id] =
                'Las asignaciones internas no permiten nombre manual.';
            }
            return;
          }

          if (participant.mode === 'specialRole') {
            if (scope !== 'internal') {
              participantErrors[participant.id] =
                'El rol especial solo se permite en asignaciones internas.';
            } else if (!participant.specialRoleKey) {
              participantErrors[participant.id] = 'Selecciona un rol especial valido.';
            }
            return;
          }

          if (!participant.userId || participant.userId.trim().length === 0) {
            if (scope === 'internal') {
              participantErrors[participant.id] = 'Selecciona un usuario valido.';
            }
          } else if (scope !== 'internal') {
            participantErrors[participant.id] =
              'Las asignaciones informativas no deben usar usuario interno.';
          }
        });

        if (Object.keys(participantErrors).length > 0) {
          assignmentErrors.participants = participantErrors;
        }

        if (
          assignmentErrors.title ||
          assignmentErrors.durationMinutes ||
          assignmentErrors.participants
        ) {
          topLevelErrors.assignments[assignment.id] = assignmentErrors;
        }
      });
    });

    setErrors(topLevelErrors);

    const hasTopLevelErrors = hasErrors({
      title: topLevelErrors.title,
      weekLabel: topLevelErrors.weekLabel,
      bibleReading: topLevelErrors.bibleReading,
      chairmanUserId: topLevelErrors.chairmanUserId,
      startDateInput: topLevelErrors.startDateInput,
      endDateInput: topLevelErrors.endDateInput,
      sections: topLevelErrors.sections,
    });

    const hasAssignmentErrors = Object.keys(topLevelErrors.assignments).length > 0;

    return {
      isValid: !hasTopLevelErrors && !hasAssignmentErrors,
      startDate: parsedStartDate ?? undefined,
      endDate: parsedEndDate ?? undefined,
    };
  };

  const updateSection = (sectionId: MidweekMeetingSection['id'], nextSection: MidweekMeetingSection) => {
    setForm((current) => {
      const nextSections = current.sections.map((section) =>
        section.id === sectionId ? nextSection : section
      );

      return {
        ...current,
        sections: normalizeSectionOrder(nextSections),
      };
    });
  };

  const handleImportPdf = async () => {
    if (!congregationId || !canEdit) return;

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

      setImportingPdf(true);

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

      router.replace('/(protected)/meetings/midweek' as never);
    } catch (requestError) {
      Alert.alert('Error', formatFirestoreError(requestError));
    } finally {
      setImportingPdf(false);
    }
  };

  const handleSave = async () => {
    if (!isAdminOrSupervisor) {
      Alert.alert('Permisos insuficientes', 'No tienes permisos para guardar reuniones entre semana.');
      return;
    }

    if (!congregationId) {
      Alert.alert('Error', profileError ?? 'No se encontro la congregacion del usuario actual.');
      return;
    }

    const validation = validate();
    if (!validation.isValid || !validation.startDate || !validation.endDate) {
      Alert.alert('Validacion', 'Revisa los campos marcados antes de guardar.');
      return;
    }

    setSaving(true);

    try {
      const attendeeNames = Array.from(
        new Set(
          form.sections
            .flatMap((section) => section.items)
            .flatMap((assignment) => assignment.participants)
            .map((participant) => participant.displayName.trim())
            .filter((name) => name.length > 0)
        )
      );

      const payload: MidweekMeetingPayload = {
        title: form.title,
        description: form.description,
        weekLabel: form.weekLabel,
        bibleReading: form.bibleReading,
        startDate: Timestamp.fromDate(validation.startDate),
        endDate: Timestamp.fromDate(validation.endDate),
        status: form.status,
        location: form.location,
        meetingUrl: form.meetingUrl,
        notes: form.notes,
        openingSong: form.openingSong,
        openingPrayer: form.openingPrayerUserId
          ? availableUsers.find((u) => u.uid === form.openingPrayerUserId)?.displayName ?? form.openingPrayer
          : form.openingPrayer,
        middleSong: form.middleSong,
        closingSong: form.closingSong,
        closingPrayer: form.closingPrayerUserId
          ? availableUsers.find((u) => u.uid === form.closingPrayerUserId)?.displayName ?? form.closingPrayer
          : form.closingPrayer,
        chairman: form.chairmanName,
        midweekSections: normalizeSectionOrder(form.sections),
        attendeeNames,
      };

      if (mode === 'create') {
        await createMidweekMeeting(congregationId, payload, {
          uid: user?.uid ?? '',
          displayName: appUser?.displayName ?? user?.email ?? 'Usuario',
        });

        Alert.alert('Exito', 'Reunion de entre semana creada correctamente.');
      } else if (id) {
        await updateMidweekMeeting(congregationId, id, payload, user?.uid);
        Alert.alert('Exito', 'Reunion de entre semana actualizada.');
      }

      router.back();
    } catch (requestError) {
      Alert.alert('Error', formatFirestoreError(requestError));
    } finally {
      setSaving(false);
    }
  };

  if (loading || loadingProfile) {
    return <LoadingState message="Cargando formulario de entre semana..." />;
  }

  const canEdit = isAdminOrSupervisor;

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <PageHeader title={mode === 'create' ? 'Nueva reunion VyMC' : 'Editar reunion VyMC'} showBack />

      <ScrollView
        contentContainerStyle={styles.form}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!canEdit ? (
          <View style={styles.permissionNotice}>
            <ThemedText style={styles.permissionText}>
              No tienes permisos para crear o editar reuniones de entre semana.
            </ThemedText>
          </View>
        ) : null}

        {canEdit ? (
          <View style={styles.importBox}>
            <View style={styles.importTextWrap}>
              <ThemedText style={styles.importTitle}>Importar desde PDF (opcional)</ThemedText>
              <ThemedText style={styles.importDescription}>
                Carga el PDF de la semana para crear o actualizar reuniones automaticamente en estado pendiente.
              </ThemedText>
            </View>

            <TouchableOpacity
              style={[styles.importButton, importingPdf && styles.disabled]}
              onPress={handleImportPdf}
              disabled={importingPdf}
              activeOpacity={0.8}
            >
              {importingPdf ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="document-attach-outline" size={16} color="#fff" />
              )}
              <ThemedText style={styles.importButtonText}>Cargar PDF</ThemedText>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.sectionBlock}>
          <ThemedText style={styles.sectionTitle}>Datos generales</ThemedText>

          <Field label="Titulo general *" error={errors.title}>
            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              value={form.title}
              onChangeText={(value) => setForm((current) => ({ ...current, title: value }))}
              placeholder="Ej: Reunion de Vida y Ministerio"
              placeholderTextColor={colors.textDisabled}
              editable={canEdit}
            />
          </Field>

          <View style={styles.inlineRow}>
            <View style={styles.inlineField}>
              <Field label="Semana *" error={errors.weekLabel}>
                <TextInput
                  style={[styles.input, errors.weekLabel && styles.inputError]}
                  value={form.weekLabel}
                  onChangeText={(value) => setForm((current) => ({ ...current, weekLabel: value }))}
                  placeholder="Ej: 6-12 de julio"
                  placeholderTextColor={colors.textDisabled}
                  editable={canEdit}
                />
              </Field>
            </View>

            <View style={styles.inlineField}>
              <Field label="Lectura biblica *" error={errors.bibleReading}>
                <TextInput
                  style={[styles.input, errors.bibleReading && styles.inputError]}
                  value={form.bibleReading}
                  onChangeText={(value) => setForm((current) => ({ ...current, bibleReading: value }))}
                  placeholder="Ej: Jeremias 13-15"
                  placeholderTextColor={colors.textDisabled}
                  editable={canEdit}
                />
              </Field>
            </View>
          </View>

          <Field label="Descripcion">
            <TextInput
              style={[styles.input, styles.multiline]}
              value={form.description}
              onChangeText={(value) => setForm((current) => ({ ...current, description: value }))}
              placeholder="Notas generales de la semana"
              placeholderTextColor={colors.textDisabled}
              multiline
              editable={canEdit}
            />
          </Field>

          <View style={styles.inlineRow}>
            <View style={styles.inlineField}>
              <Field label="Inicio (YYYY-MM-DD HH:mm)" error={errors.startDateInput}>
                <TextInput
                  style={[styles.input, errors.startDateInput && styles.inputError]}
                  value={form.startDateInput}
                  onChangeText={(value) => setForm((current) => ({ ...current, startDateInput: value }))}
                  placeholder="2026-07-06 19:30"
                  placeholderTextColor={colors.textDisabled}
                  editable={canEdit}
                />
              </Field>
            </View>

            <View style={styles.inlineField}>
              <Field label="Fin (YYYY-MM-DD HH:mm)" error={errors.endDateInput}>
                <TextInput
                  style={[styles.input, errors.endDateInput && styles.inputError]}
                  value={form.endDateInput}
                  onChangeText={(value) => setForm((current) => ({ ...current, endDateInput: value }))}
                  placeholder="2026-07-06 21:00"
                  placeholderTextColor={colors.textDisabled}
                  editable={canEdit}
                />
              </Field>
            </View>
          </View>

          <View style={styles.inlineRow}>
            <View style={styles.inlineField}>
              <Field label="Lugar">
                <TextInput
                  style={styles.input}
                  value={form.location}
                  onChangeText={(value) => setForm((current) => ({ ...current, location: value }))}
                  placeholder="Salon principal"
                  placeholderTextColor={colors.textDisabled}
                  editable={canEdit}
                />
              </Field>
            </View>

            <View style={styles.inlineField}>
              <Field label="Enlace">
                <TextInput
                  style={styles.input}
                  value={form.meetingUrl}
                  onChangeText={(value) => setForm((current) => ({ ...current, meetingUrl: value }))}
                  placeholder="https://..."
                  placeholderTextColor={colors.textDisabled}
                  editable={canEdit}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </Field>
            </View>
          </View>

          <Field label="Estado">
            <View style={styles.chipsRow}>
              {statusOptions.map((statusOption) => (
                <TouchableOpacity
                  key={statusOption}
                  style={[styles.chip, form.status === statusOption && styles.chipActive]}
                  onPress={() => setForm((current) => ({ ...current, status: statusOption }))}
                  disabled={!canEdit}
                  activeOpacity={0.8}
                >
                  <ThemedText style={[styles.chipText, form.status === statusOption && styles.chipTextActive]}>
                    {MEETING_STATUS_LABELS[statusOption]}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </Field>
        </View>

        <View style={styles.sectionBlock}>
          <ThemedText style={styles.sectionTitle}>Apertura y cierre</ThemedText>

          {/* Presidente - selector obligatorio de usuario */}
          <Field label="Presidente *" error={errors.chairmanUserId}>
            <UserPickerField
              label="Seleccionar presidente"
              users={availableUsers}
              selectedUserId={form.chairmanUserId}
              disabled={!canEdit}
              hasError={Boolean(errors.chairmanUserId)}
              onSelect={(user) =>
                setForm((current) => ({
                  ...current,
                  chairmanUserId: user.uid,
                  chairmanName: user.displayName,
                }))
              }
            />
          </Field>

          <View style={styles.inlineRow}>
            <View style={styles.inlineField}>
              <Field label="Cancion inicial">
                <TextInput
                  style={styles.input}
                  value={form.openingSong}
                  onChangeText={(value) => setForm((current) => ({ ...current, openingSong: value }))}
                  placeholder="Ej: Cancion 12"
                  placeholderTextColor={colors.textDisabled}
                  editable={canEdit}
                />
              </Field>
            </View>

            <View style={styles.inlineField}>
              <Field label="Oracion inicial">
                <UserPickerField
                  label="Seleccionar hermano"
                  users={availableUsers}
                  selectedUserId={form.openingPrayerUserId}
                  disabled={!canEdit}
                  onSelect={(user) =>
                    setForm((current) => ({
                      ...current,
                      openingPrayerUserId: user.uid,
                      openingPrayer: user.displayName,
                    }))
                  }
                />
              </Field>
            </View>
          </View>

          <View style={styles.inlineRow}>
            <View style={styles.inlineField}>
              <Field label="Cancion intermedia">
                <TextInput
                  style={styles.input}
                  value={form.middleSong}
                  onChangeText={(value) => setForm((current) => ({ ...current, middleSong: value }))}
                  placeholder="Ej: Cancion 65"
                  placeholderTextColor={colors.textDisabled}
                  editable={canEdit}
                />
              </Field>
            </View>

            <View style={styles.inlineField}>
              <Field label="Cancion final">
                <TextInput
                  style={styles.input}
                  value={form.closingSong}
                  onChangeText={(value) => setForm((current) => ({ ...current, closingSong: value }))}
                  placeholder="Ej: Cancion 56"
                  placeholderTextColor={colors.textDisabled}
                  editable={canEdit}
                />
              </Field>
            </View>
          </View>

          <Field label="Oracion final">
            <UserPickerField
              label="Seleccionar hermano"
              users={availableUsers}
              selectedUserId={form.closingPrayerUserId}
              disabled={!canEdit}
              onSelect={(user) =>
                setForm((current) => ({
                  ...current,
                  closingPrayerUserId: user.uid,
                  closingPrayer: user.displayName,
                }))
              }
            />
          </Field>
        </View>

        <View style={styles.sectionBlock}>
          <ThemedText style={styles.sectionTitle}>Secciones VyMC</ThemedText>
          {errors.sections ? <ThemedText style={styles.errorText}>{errors.sections}</ThemedText> : null}

          {form.sections.map((section) => (
            <MidweekSectionEditor
              key={section.id}
              section={section}
              users={availableUsers}
              disabled={!canEdit}
              errors={errors.assignments}
              onChange={(nextSection) => updateSection(section.id, nextSection)}
            />
          ))}
        </View>

        <Field label="Notas generales">
          <TextInput
            style={[styles.input, styles.multiline]}
            value={form.notes}
            onChangeText={(value) => setForm((current) => ({ ...current, notes: value }))}
            placeholder="Observaciones adicionales"
            placeholderTextColor={colors.textDisabled}
            multiline
            editable={canEdit}
          />
        </Field>

        <TouchableOpacity
          style={[styles.saveButton, (saving || !canEdit) && styles.disabled]}
          onPress={handleSave}
          disabled={saving || !canEdit}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.saveButtonText}>
              {mode === 'create' ? 'Crear reunion VyMC' : 'Guardar cambios'}
            </ThemedText>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}


function UserPickerField({
  label,
  users,
  selectedUserId,
  disabled,
  hasError,
  onSelect,
}: {
  label: string;
  users: ActiveCongregationUser[];
  selectedUserId: string;
  disabled?: boolean;
  hasError?: boolean;
  onSelect: (user: ActiveCongregationUser) => void;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const [upeExpanded, setUpeExpanded] = React.useState(false);
  const selectedUser = users.find((u) => u.uid === selectedUserId);
  return (
    <View>
      <TouchableOpacity
        style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderColor: hasError ? colors.error : colors.border }]}
        onPress={() => !disabled && setUpeExpanded((e) => !e)}
        activeOpacity={0.8}
        disabled={disabled}
      >
        <ThemedText style={{ flex: 1, fontSize: 14, color: selectedUser ? colors.textPrimary : colors.textDisabled }} numberOfLines={1}>
          {selectedUser?.displayName ?? label}
        </ThemedText>
        <Ionicons name={upeExpanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={16} color={colors.textMuted} />
      </TouchableOpacity>
      {upeExpanded ? (
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.surface, maxHeight: 220, marginTop: 4 }}>
          {users.length === 0 ? (
            <ThemedText style={{ padding: 12, color: colors.textMuted, fontSize: 13 }}>No hay usuarios activos.</ThemedText>
          ) : users.map((user) => {
            const isSelected = user.uid === selectedUserId;
            return (
              <TouchableOpacity
                key={user.uid}
                onPress={() => { onSelect(user); setUpeExpanded(false); }}
                style={{ paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: isSelected ? (colors.primary + '22') : undefined }}
                activeOpacity={0.7}
              >
                <ThemedText style={{ fontSize: 14, color: isSelected ? colors.primary : colors.textPrimary, fontWeight: isSelected ? '700' : '500' }}>
                  {user.displayName}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
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
    form: {
      padding: 16,
      gap: 18,
      paddingBottom: 32,
    },
    sectionBlock: {
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      padding: 12,
    },
    importBox: {
      gap: 10,
      borderWidth: 1,
      borderColor: colors.info + '55',
      borderRadius: 12,
      backgroundColor: colors.infoLight,
      padding: 12,
    },
    importTextWrap: {
      gap: 4,
    },
    importTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.infoDark,
    },
    importDescription: {
      fontSize: 12,
      color: colors.infoDark,
    },
    importButton: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.info,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    importButtonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 13,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textSecondary,
    },
    fieldWrap: {
      gap: 6,
    },
    label: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.backgroundLight,
      color: colors.textPrimary,
      fontSize: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    inputError: {
      borderColor: colors.error,
    },
    multiline: {
      minHeight: 90,
      textAlignVertical: 'top',
    },
    inlineRow: {
      flexDirection: 'row',
      gap: 10,
    },
    inlineField: {
      flex: 1,
    },
    chipsRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.backgroundLight,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
    },
    chipTextActive: {
      color: '#fff',
    },
    errorText: {
      color: colors.error,
      fontSize: 12,
    },
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    saveButtonText: {
      color: '#fff',
      fontWeight: '800',
      fontSize: 15,
    },
    disabled: {
      opacity: 0.6,
    },
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
  });
