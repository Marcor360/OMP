import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { LoadingState } from '@/src/components/common/LoadingState';
import { DatePickerModal } from '@/src/components/forms/DatePickerModal';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import {
  createEvent,
  eventToFormValues,
  getEventById,
  updateEvent,
  validateEventForm,
} from '@/src/services/events/events-service';
import {
  CongregationEvent,
  CongregationEventFormValues,
  CongregationEventType,
  EVENT_TYPE_LABELS,
  OPTIONAL_END_DATE_EVENT_TYPES,
  SINGLE_DAY_EVENT_TYPES,
} from '@/src/types/event';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { formatFirestoreError } from '@/src/utils/errors/errors';

interface EventFormScreenProps {
  mode?: 'create' | 'edit';
}

const EVENT_TYPES = Object.keys(EVENT_TYPE_LABELS) as CongregationEventType[];

const todayInput = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function EventFormScreen({ mode = 'create' }: EventFormScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const eventId = typeof params.id === 'string' ? params.id : null;
  const { uid, congregationId, isAdminOrSupervisor, loadingProfile, profileError } = useUser();
  const colors = useAppColors();
  const styles = createStyles(colors);

  const [event, setEvent] = useState<CongregationEvent | null>(null);
  const [values, setValues] = useState<CongregationEventFormValues>(
    eventToFormValues(null)
  );
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [activeDatePicker, setActiveDatePicker] = useState<
    'startDate' | 'endDate' | null
  >(null);

  const isSingleDay = SINGLE_DAY_EVENT_TYPES.includes(values.type);
  const hasOptionalEndDate = OPTIONAL_END_DATE_EVENT_TYPES.includes(values.type);
  const isSuperintendentVisit = values.type === 'visita_superintendente';

  const subtitle = useMemo(
    () => (mode === 'create' ? 'Crear evento' : 'Editar evento'),
    [mode]
  );

  useEffect(() => {
    if (mode !== 'edit' || !eventId) {
      return;
    }

    let cancelled = false;

    const loadEvent = async () => {
      try {
        const found = await getEventById(eventId);
        if (cancelled) return;

        if (!found) {
          Alert.alert('Error', 'Evento no encontrado.');
          router.back();
          return;
        }

        setEvent(found);
        setValues(eventToFormValues(found));
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

    void loadEvent();

    return () => {
      cancelled = true;
    };
  }, [eventId, mode, router]);

  const updateValue = (key: keyof CongregationEventFormValues, value: string) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };

      if (key === 'type') {
        next.endDate = SINGLE_DAY_EVENT_TYPES.includes(value as CongregationEventType)
          ? next.startDate
          : next.endDate;
      }

      if (key === 'startDate' && SINGLE_DAY_EVENT_TYPES.includes(next.type)) {
        next.endDate = value;
      }

      return next;
    });
  };

  const handleSubmit = async () => {
    if (!isAdminOrSupervisor) {
      Alert.alert('Permisos insuficientes', 'Solo administradores y supervisores pueden administrar eventos.');
      return;
    }

    if (!uid || !congregationId) {
      Alert.alert('Error', profileError ?? 'No se encontro la congregacion del usuario actual.');
      return;
    }

    const validationErrors = validateEventForm(values);
    const today = todayInput();
    if (values.startDate && values.startDate < today) {
      validationErrors.push('No se pueden seleccionar fechas que ya pasaron.');
    }
    setErrors(validationErrors);

    if (validationErrors.length > 0) {
      Alert.alert('Validacion', validationErrors.join('\n'));
      return;
    }

    setSaving(true);
    try {
      if (mode === 'edit' && eventId) {
        await updateEvent({
          eventId,
          values,
          congregationId,
          uid,
        });
        Alert.alert('Evento actualizado', 'El evento se actualizo correctamente.');
      } else {
        await createEvent({
          values,
          congregationId,
          uid,
        });
        Alert.alert('Evento creado', 'El evento se creo correctamente.');
      }

      router.back();
    } catch (requestError) {
      Alert.alert('Error', formatFirestoreError(requestError));
    } finally {
      setSaving(false);
    }
  };

  if (loading || loadingProfile) {
    return <LoadingState message="Cargando evento..." />;
  }

  if (!isAdminOrSupervisor) {
    return (
      <ScreenContainer padded={false}>
        <PageHeader title="Eventos" subtitle="Sin permisos" showBack />
        <View style={styles.center}>
          <ThemedText style={styles.errorText}>
            Solo administradores y supervisores pueden administrar eventos.
          </ThemedText>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <PageHeader title="Eventos" subtitle={subtitle} showBack />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Field label="Tipo de evento">
          <View style={styles.typeGrid}>
            {EVENT_TYPES.map((type) => {
              const active = values.type === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, active && styles.typeChipActive]}
                  onPress={() => updateValue('type', type)}
                  activeOpacity={0.8}
                >
                  <ThemedText style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                    {EVENT_TYPE_LABELS[type]}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        </Field>

        {isSuperintendentVisit ? (
          <>
            <Field label="Nombre del superintendente *">
              <Input
                value={values.superintendentName}
                onChangeText={(value) => updateValue('superintendentName', value)}
                placeholder="Ej: Juan Perez"
              />
            </Field>
            <Field label="Nombre de la esposa">
              <Input
                value={values.superintendentWifeName}
                onChangeText={(value) => updateValue('superintendentWifeName', value)}
                placeholder="Opcional"
              />
            </Field>
          </>
        ) : (
          <Field label="Titulo *">
            <Input
              value={values.title}
              onChangeText={(value) => updateValue('title', value)}
              placeholder="Nombre del evento"
            />
          </Field>
        )}

        <Field label="Fecha inicial *">
          <DateField
            value={values.startDate}
            placeholder="YYYY-MM-DD"
            onPress={() => setActiveDatePicker('startDate')}
          />
        </Field>

        <Field label={hasOptionalEndDate ? 'Fecha final' : 'Fecha final *'}>
          <DateField
            value={isSingleDay ? values.startDate : values.endDate}
            placeholder={hasOptionalEndDate ? 'Opcional, YYYY-MM-DD' : 'YYYY-MM-DD'}
            disabled={isSingleDay}
            onPress={() => {
              if (!isSingleDay) {
                setActiveDatePicker('endDate');
              }
            }}
          />
        </Field>

        {!isSuperintendentVisit ? (
          <Field label="Lugar">
            <Input
              value={values.location}
              onChangeText={(value) => updateValue('location', value)}
              placeholder="Opcional"
            />
          </Field>
        ) : null}

        {errors.length > 0 ? (
          <View style={styles.errorBox}>
            {errors.map((error) => (
              <ThemedText key={error} style={styles.errorText}>
                {error}
              </ThemedText>
            ))}
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSubmit}
          disabled={saving}
          activeOpacity={0.8}
        >
          <ThemedText style={styles.saveButtonText}>
            {saving ? 'Guardando...' : mode === 'edit' ? 'Actualizar evento' : 'Crear evento'}
          </ThemedText>
        </TouchableOpacity>
      </ScrollView>
      <DatePickerModal
        visible={activeDatePicker !== null}
        selectedDate={activeDatePicker ? values[activeDatePicker] || null : null}
        minDate={activeDatePicker === 'endDate' ? values.startDate || todayInput() : todayInput()}
        title={
          activeDatePicker === 'endDate'
            ? 'Seleccionar fecha final'
            : 'Seleccionar fecha inicial'
        }
        onSelectDate={(date) => {
          if (activeDatePicker) {
            updateValue(activeDatePicker, date);
          }
        }}
        onClose={() => setActiveDatePicker(null)}
      />
    </ScreenContainer>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const colors = useAppColors();
  return (
    <View style={{ gap: 7 }}>
      <ThemedText style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700' }}>
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  return (
    <TextInput
      {...props}
      placeholderTextColor={colors.textDisabled}
      style={[styles.input, props.editable === false && styles.inputDisabled, props.style]}
    />
  );
}

function DateField({
  value,
  placeholder,
  disabled = false,
  onPress,
}: {
  value: string;
  placeholder: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  return (
    <TouchableOpacity
      style={[styles.dateField, disabled && styles.inputDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <ThemedText style={[styles.dateFieldText, !value && styles.dateFieldPlaceholder]}>
        {value || placeholder}
      </ThemedText>
      <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    scroll: {
      flex: 1,
    },
    content: {
      padding: 16,
      gap: 16,
      paddingBottom: 32,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    typeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    typeChip: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    typeChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    typeChipText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    typeChipTextActive: {
      color: colors.onPrimary,
    },
    input: {
      minHeight: 46,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      paddingHorizontal: 12,
      fontSize: 14,
      fontWeight: '600',
    },
    inputDisabled: {
      opacity: 0.7,
      backgroundColor: colors.surfaceRaised,
    },
    dateField: {
      minHeight: 46,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    dateFieldText: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    dateFieldPlaceholder: {
      color: colors.textDisabled,
    },
    errorBox: {
      gap: 4,
      borderWidth: 1,
      borderColor: colors.error + '55',
      backgroundColor: colors.error + '12',
      borderRadius: 8,
      padding: 10,
    },
    errorText: {
      color: colors.error,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
    },
    saveButton: {
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: colors.primary,
      marginTop: 4,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
  });
