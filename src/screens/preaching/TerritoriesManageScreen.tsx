import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { EmptyState } from '@/src/components/common/EmptyState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import { useTerritories, useTerritoryMutations, useTerritorySchedule } from '@/src/hooks/use-territories';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import {
  TERRITORY_DAY_LABELS,
  TERRITORY_DAY_NOTE_MAX_LENGTH,
  TERRITORY_DAYS,
  TERRITORY_DESCRIPTION_MAX_LENGTH,
  TERRITORY_NAME_MAX_LENGTH,
  type Territory,
  type TerritoryDayOfWeek,
  type TerritoryFormValues,
} from '@/src/types/territory';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import {
  canManageTerritories,
  hasTerritoryPermission,
} from '@/src/utils/permissions/permissions';

type TerritoryFormState = {
  id?: string;
  number: string;
  name: string;
  description: string;
};

const emptyForm: TerritoryFormState = {
  number: '',
  name: '',
  description: '',
};

const validateTerritoryForm = (form: TerritoryFormState): TerritoryFormValues | null => {
  const name = form.name.trim();
  const description = form.description.trim();
  const numberText = form.number.trim();

  if (!name) return null;
  if (name.length > TERRITORY_NAME_MAX_LENGTH) return null;
  if (description.length > TERRITORY_DESCRIPTION_MAX_LENGTH) return null;

  const parsedNumber = numberText ? Number(numberText) : null;
  if (parsedNumber !== null && (!Number.isInteger(parsedNumber) || parsedNumber < 0)) {
    return null;
  }

  return {
    number: parsedNumber,
    name,
    description,
  };
};

export function TerritoriesManageScreen() {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { appUser, uid, congregationId, loadingProfile } = useUser();
  const { territories, activeTerritories, loading, error } = useTerritories(congregationId);
  const scheduleState = useTerritorySchedule(congregationId);
  const mutations = useTerritoryMutations(congregationId, uid);
  const [form, setForm] = useState<TerritoryFormState>(emptyForm);
  const [scheduleNotes, setScheduleNotes] = useState<Partial<Record<TerritoryDayOfWeek, string>>>({});

  const canManage = canManageTerritories(appUser);
  const canCreate = hasTerritoryPermission(appUser, 'create');
  const canEdit = hasTerritoryPermission(appUser, 'edit');
  const canDeactivate = hasTerritoryPermission(appUser, 'delete');
  const canAssign = hasTerritoryPermission(appUser, 'assign');

  const scheduleByDay = useMemo(
    () => new Map(scheduleState.schedule.map((item) => [item.dayOfWeek, item])),
    [scheduleState.schedule]
  );

  if (loadingProfile || loading || scheduleState.loading) {
    return <LoadingState message="Cargando territorios..." />;
  }

  if (!appUser || !canManage) {
    return <ErrorState message="No tienes permisos para administrar territorios." />;
  }

  if (error || scheduleState.error) {
    return <ErrorState message={error ?? scheduleState.error ?? undefined} />;
  }

  const editing = Boolean(form.id);
  const formValues = validateTerritoryForm(form);
  const formError =
    form.name.trim().length === 0
      ? 'El nombre es obligatorio.'
      : form.name.trim().length > TERRITORY_NAME_MAX_LENGTH
        ? `El nombre no puede superar ${TERRITORY_NAME_MAX_LENGTH} caracteres.`
        : form.description.trim().length > TERRITORY_DESCRIPTION_MAX_LENGTH
          ? `La descripcion no puede superar ${TERRITORY_DESCRIPTION_MAX_LENGTH} caracteres.`
          : form.number.trim() && !Number.isInteger(Number(form.number.trim()))
            ? 'El numero debe ser entero.'
            : null;

  const resetForm = () => setForm(emptyForm);

  const fillForm = (territory: Territory) => {
    setForm({
      id: territory.id,
      number: territory.number == null ? '' : String(territory.number),
      name: territory.name,
      description: territory.description,
    });
  };

  const handleSaveTerritory = async () => {
    if (!formValues) {
      Alert.alert('Datos incompletos', formError ?? 'Revisa los datos del territorio.');
      return;
    }

    try {
      if (editing && form.id) {
        await mutations.updateTerritory(form.id, formValues);
      } else {
        await mutations.createTerritory(formValues);
      }
      resetForm();
    } catch (saveError) {
      Alert.alert('Error', formatFirestoreError(saveError));
    }
  };

  const handleDeactivate = (territory: Territory) => {
    Alert.alert(
      'Desactivar territorio',
      `Se desactivara "${territory.name}" y ya no podra asignarse.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desactivar',
          style: 'destructive',
          onPress: async () => {
            try {
              await mutations.deactivateTerritory(territory.id);
            } catch (deactivateError) {
              Alert.alert('Error', formatFirestoreError(deactivateError));
            }
          },
        },
      ]
    );
  };

  const handleToggleDayTerritory = async (day: TerritoryDayOfWeek, territoryId: string) => {
    const currentSchedule = scheduleByDay.get(day);
    const currentIds = currentSchedule?.territoryIds ?? [];
    const nextIds = currentIds.includes(territoryId)
      ? currentIds.filter((id) => id !== territoryId)
      : [...currentIds, territoryId];
    const note = scheduleNotes[day] ?? currentSchedule?.note ?? '';

    try {
      await mutations.assignTerritoriesToDay(day, nextIds, note.trim());
    } catch (assignError) {
      Alert.alert('Error', formatFirestoreError(assignError));
    }
  };

  const handleSaveDayNote = async (day: TerritoryDayOfWeek) => {
    const currentSchedule = scheduleByDay.get(day);
    const note = scheduleNotes[day] ?? currentSchedule?.note ?? '';

    if (note.length > TERRITORY_DAY_NOTE_MAX_LENGTH) {
      Alert.alert('Nota demasiado larga', `La nota no puede superar ${TERRITORY_DAY_NOTE_MAX_LENGTH} caracteres.`);
      return;
    }

    try {
      await mutations.assignTerritoriesToDay(day, currentSchedule?.territoryIds ?? [], note.trim());
    } catch (noteError) {
      Alert.alert('Error', formatFirestoreError(noteError));
    }
  };

  return (
    <ScreenContainer>
      <PageHeader title="Administrar territorios" showBack />

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>
          {editing ? 'Editar territorio' : 'Crear territorio'}
        </ThemedText>
        <View style={styles.inputGrid}>
          <TextInput
            style={styles.input}
            value={form.number}
            onChangeText={(value) => setForm((current) => ({ ...current, number: value }))}
            placeholder="Numero"
            placeholderTextColor={colors.textDisabled}
            keyboardType="number-pad"
            editable={(editing ? canEdit : canCreate) && !mutations.saving}
          />
          <View style={styles.fieldBlock}>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
              placeholder="Nombre del territorio"
              placeholderTextColor={colors.textDisabled}
              maxLength={TERRITORY_NAME_MAX_LENGTH + 10}
              editable={(editing ? canEdit : canCreate) && !mutations.saving}
            />
            <Counter value={form.name.length} max={TERRITORY_NAME_MAX_LENGTH} />
          </View>
          <View style={styles.fieldBlock}>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={form.description}
              onChangeText={(value) => setForm((current) => ({ ...current, description: value }))}
              placeholder="Descripcion"
              placeholderTextColor={colors.textDisabled}
              maxLength={TERRITORY_DESCRIPTION_MAX_LENGTH + 20}
              multiline
              editable={(editing ? canEdit : canCreate) && !mutations.saving}
            />
            <Counter value={form.description.length} max={TERRITORY_DESCRIPTION_MAX_LENGTH} />
          </View>
        </View>

        {formError ? <ThemedText style={styles.errorText}>{formError}</ThemedText> : null}

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!formValues || mutations.saving || (editing ? !canEdit : !canCreate)) && styles.disabledButton,
            ]}
            onPress={handleSaveTerritory}
            disabled={!formValues || mutations.saving || (editing ? !canEdit : !canCreate)}
            activeOpacity={0.85}
          >
            <Ionicons name={editing ? 'save-outline' : 'add-outline'} size={18} color={colors.onPrimary} />
            <ThemedText style={styles.primaryButtonText}>
              {editing ? 'Guardar cambios' : 'Crear territorio'}
            </ThemedText>
          </TouchableOpacity>
          {editing ? (
            <TouchableOpacity style={styles.secondaryButton} onPress={resetForm} activeOpacity={0.85}>
              <ThemedText style={styles.secondaryButtonText}>Cancelar</ThemedText>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Territorios registrados</ThemedText>
        {territories.length === 0 ? (
          <EmptyState
            icon="map-outline"
            title="Sin territorios"
            description="Crea el primer territorio para comenzar a asignarlo por dia."
          />
        ) : (
          <View style={styles.list}>
            {territories.map((territory) => (
              <View key={territory.id} style={styles.territoryCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleBlock}>
                    <ThemedText style={styles.cardTitle}>
                      {territory.number ? `${territory.number}. ` : ''}
                      {territory.name}
                    </ThemedText>
                    <ThemedText style={[
                      styles.statusText,
                      territory.status === 'active' ? styles.activeText : styles.inactiveText,
                    ]}>
                      {territory.status === 'active' ? 'Activo' : 'Inactivo'}
                    </ThemedText>
                  </View>
                  <View style={styles.iconActions}>
                    {canEdit ? (
                      <TouchableOpacity style={styles.iconButton} onPress={() => fillForm(territory)}>
                        <Ionicons name="create-outline" size={18} color={colors.primary} />
                      </TouchableOpacity>
                    ) : null}
                    {canDeactivate && territory.status === 'active' ? (
                      <TouchableOpacity style={styles.iconButton} onPress={() => handleDeactivate(territory)}>
                        <Ionicons name="archive-outline" size={18} color={colors.error} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
                {territory.description ? (
                  <ThemedText style={styles.descriptionText}>{territory.description}</ThemedText>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Calendario semanal</ThemedText>
        <View style={styles.list}>
          {TERRITORY_DAYS.map((day) => {
            const currentSchedule = scheduleByDay.get(day);
            const note = scheduleNotes[day] ?? currentSchedule?.note ?? '';

            return (
              <View key={day} style={styles.dayCard}>
                <ThemedText style={styles.dayTitle}>{TERRITORY_DAY_LABELS[day]}</ThemedText>
                <View style={styles.chipWrap}>
                  {activeTerritories.map((territory) => {
                    const selected = currentSchedule?.territoryIds.includes(territory.id) === true;
                    return (
                      <TouchableOpacity
                        key={`${day}:${territory.id}`}
                        style={[styles.territoryChip, selected && styles.territoryChipSelected]}
                        onPress={() => handleToggleDayTerritory(day, territory.id)}
                        disabled={!canAssign || mutations.saving}
                        activeOpacity={0.85}
                      >
                        <ThemedText
                          style={[styles.territoryChipText, selected && styles.territoryChipTextSelected]}
                        >
                          {territory.number ? `${territory.number}. ` : ''}
                          {territory.name}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {activeTerritories.length === 0 ? (
                  <ThemedText style={styles.hintText}>No hay territorios activos para asignar.</ThemedText>
                ) : null}
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={note}
                  onChangeText={(value) => setScheduleNotes((current) => ({ ...current, [day]: value }))}
                  placeholder="Nota del dia"
                  placeholderTextColor={colors.textDisabled}
                  maxLength={TERRITORY_DAY_NOTE_MAX_LENGTH + 30}
                  multiline
                  editable={canAssign && !mutations.saving}
                />
                <View style={styles.noteFooter}>
                  <Counter value={note.length} max={TERRITORY_DAY_NOTE_MAX_LENGTH} />
                  <TouchableOpacity
                    style={[styles.smallButton, (!canAssign || note.length > TERRITORY_DAY_NOTE_MAX_LENGTH) && styles.disabledButton]}
                    onPress={() => handleSaveDayNote(day)}
                    disabled={!canAssign || note.length > TERRITORY_DAY_NOTE_MAX_LENGTH}
                  >
                    <ThemedText style={styles.smallButtonText}>Guardar nota</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </ScreenContainer>
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  const colors = useAppColors();
  const overLimit = value > max;
  return (
    <ThemedText style={{ color: overLimit ? colors.error : colors.textMuted, fontSize: 11, fontWeight: '700' }}>
      {value}/{max}
    </ThemedText>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    section: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 14,
      gap: 12,
      marginBottom: 14,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: '800',
    },
    inputGrid: {
      gap: 10,
    },
    fieldBlock: {
      gap: 4,
    },
    input: {
      minHeight: 46,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundLight,
      color: colors.textPrimary,
      paddingHorizontal: 12,
      fontSize: 14,
    },
    multilineInput: {
      minHeight: 82,
      paddingTop: 12,
      textAlignVertical: 'top',
    },
    errorText: {
      color: colors.error,
      fontSize: 12,
      fontWeight: '700',
    },
    buttonRow: {
      gap: 8,
    },
    primaryButton: {
      minHeight: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
    },
    disabledButton: {
      opacity: 0.45,
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    secondaryButton: {
      minHeight: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryButtonText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '800',
    },
    list: {
      gap: 10,
    },
    territoryCard: {
      borderRadius: 10,
      backgroundColor: colors.surfaceRaised,
      padding: 12,
      gap: 8,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 10,
    },
    cardTitleBlock: {
      flex: 1,
      minWidth: 0,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    statusText: {
      fontSize: 11,
      fontWeight: '800',
      marginTop: 3,
    },
    activeText: {
      color: colors.success,
    },
    inactiveText: {
      color: colors.textMuted,
    },
    iconActions: {
      flexDirection: 'row',
      gap: 6,
    },
    iconButton: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundLight,
    },
    descriptionText: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    dayCard: {
      borderRadius: 10,
      backgroundColor: colors.surfaceRaised,
      padding: 12,
      gap: 10,
    },
    dayTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    territoryChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundLight,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    territoryChipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.infoLight,
    },
    territoryChipText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    territoryChipTextSelected: {
      color: colors.primary,
    },
    hintText: {
      color: colors.textMuted,
      fontSize: 13,
    },
    noteFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
    },
    smallButton: {
      minHeight: 34,
      borderRadius: 10,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    smallButtonText: {
      color: colors.onPrimary,
      fontSize: 12,
      fontWeight: '800',
    },
  });
