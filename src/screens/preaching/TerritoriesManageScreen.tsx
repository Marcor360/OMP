import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import { useI18n } from '@/src/i18n/index';
import { useTerritoryMutations, useTerritorySchedule } from '@/src/hooks/use-territories';
import { sanitizeTerritoryItems } from '@/src/services/territories/territories-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import {
  TERRITORIES_PER_DAY_MAX,
  TERRITORY_DAY_LABELS,
  TERRITORY_DAYS,
  TERRITORY_DESCRIPTION_MAX_LENGTH,
  type TerritoryDay,
  type TerritoryItem,
} from '@/src/types/territory';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { canManageTerritories } from '@/src/utils/permissions/permissions';

type TerritoryDraft = {
  number: string;
  description: string;
  enabled: boolean;
};

const emptyDraft = (): TerritoryDraft => ({
  number: '',
  description: '',
  enabled: true,
});

const toDraft = (territory: TerritoryItem): TerritoryDraft => ({
  number: String(territory.number),
  description: territory.description,
  enabled: territory.enabled,
});

const toTerritoryItems = (drafts: TerritoryDraft[]): TerritoryItem[] =>
  drafts.map((draft) => ({
    number: Number(draft.number.trim()),
    description: draft.description.trim(),
    enabled: draft.enabled,
  }));

export function TerritoriesManageScreen() {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { t } = useI18n();
  const { appUser, uid, congregationId, loadingProfile } = useUser();
  const { scheduleByDay, loading, error } = useTerritorySchedule(congregationId);
  const mutations = useTerritoryMutations(congregationId, uid);
  const [selectedDay, setSelectedDay] = useState<TerritoryDay>('monday');
  const [draftsByDay, setDraftsByDay] = useState<Partial<Record<TerritoryDay, TerritoryDraft[]>>>({});

  const canManage = canManageTerritories(appUser);
  const selectedSchedule = scheduleByDay.get(selectedDay);
  const drafts = useMemo(
    () => draftsByDay[selectedDay] ?? [emptyDraft()],
    [draftsByDay, selectedDay]
  );

  useEffect(() => {
    const nextDrafts: Partial<Record<TerritoryDay, TerritoryDraft[]>> = {};

    TERRITORY_DAYS.forEach((day) => {
      const territories = scheduleByDay.get(day)?.territories ?? [];
      nextDrafts[day] = territories.length > 0 ? territories.map(toDraft) : [emptyDraft()];
    });

    setDraftsByDay(nextDrafts);
  }, [scheduleByDay]);

  const formError = useMemo(() => {
    try {
      sanitizeTerritoryItems(toTerritoryItems(drafts));
      return null;
    } catch (validationError) {
      return validationError instanceof Error
        ? validationError.message
        : t('territories.invalidData');
    }
  }, [drafts, t]);

  const setDraftsForSelectedDay = (updater: (current: TerritoryDraft[]) => TerritoryDraft[]) => {
    setDraftsByDay((current) => ({
      ...current,
      [selectedDay]: updater(current[selectedDay] ?? [emptyDraft()]),
    }));
  };

  const handleChangeDraft = (
    index: number,
    key: keyof TerritoryDraft,
    value: string | boolean
  ) => {
    setDraftsForSelectedDay((current) =>
      current.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, [key]: value } : draft
      )
    );
  };

  const handleAddTerritory = () => {
    setDraftsForSelectedDay((current) =>
      current.length >= TERRITORIES_PER_DAY_MAX ? current : [...current, emptyDraft()]
    );
  };

  const handleRemoveTerritory = (index: number) => {
    setDraftsForSelectedDay((current) =>
      current.length <= 1 ? [emptyDraft()] : current.filter((_, draftIndex) => draftIndex !== index)
    );
  };

  const handleSave = async () => {
    try {
      const territories = sanitizeTerritoryItems(toTerritoryItems(drafts));

      if (selectedSchedule) {
        await mutations.updateTerritorySchedule(selectedDay, { territories, active: true });
      } else {
        await mutations.createTerritorySchedule({
          dayOfWeek: selectedDay,
          territories,
          active: true,
        });
      }

      Alert.alert(t('common.success'), t('territories.saved'));
    } catch (saveError) {
      Alert.alert(t('common.error'), formatFirestoreError(saveError));
    }
  };

  const handleDeleteDay = () => {
    if (!selectedSchedule) return;

    Alert.alert(
      t('territories.deleteDayTitle'),
      t('territories.deleteDayConfirm', { day: TERRITORY_DAY_LABELS[selectedDay] }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('territories.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await mutations.deleteTerritorySchedule(selectedDay);
              setDraftsForSelectedDay(() => [emptyDraft()]);
            } catch (deleteError) {
              Alert.alert(t('common.error'), formatFirestoreError(deleteError));
            }
          },
        },
      ]
    );
  };

  if (loadingProfile || loading) {
    return <LoadingState message={t('territories.loading')} />;
  }

  if (!appUser || !canManage) {
    return <ErrorState message={t('territories.noPermission')} />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  return (
    <ScreenContainer>
      <PageHeader title={t('territories.manageTitle')} showBack />

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>{t('territories.day')}</ThemedText>
        <View style={styles.dayGrid}>
          {TERRITORY_DAYS.map((day) => {
            const selected = selectedDay === day;
            return (
              <TouchableOpacity
                key={day}
                style={[styles.dayButton, selected && styles.dayButtonActive]}
                onPress={() => setSelectedDay(day)}
                activeOpacity={0.85}
              >
                <ThemedText style={[styles.dayButtonText, selected && styles.dayButtonTextActive]}>
                  {TERRITORY_DAY_LABELS[day]}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>
            {TERRITORY_DAY_LABELS[selectedDay]}
          </ThemedText>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleAddTerritory}
            disabled={drafts.length >= TERRITORIES_PER_DAY_MAX}
            activeOpacity={0.85}
          >
            <Ionicons name="add-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.list}>
          {drafts.map((draft, index) => {
            const descriptionTooLong = draft.description.length > TERRITORY_DESCRIPTION_MAX_LENGTH;

            return (
              <View key={`${selectedDay}:${index}`} style={styles.territoryCard}>
                <View style={styles.cardHeader}>
                  <ThemedText style={styles.cardTitle}>
                    {t('territories.itemIndex', { index: index + 1 })}
                  </ThemedText>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[styles.statusButton, draft.enabled ? styles.enabledButton : styles.disabledStatusButton]}
                      onPress={() => handleChangeDraft(index, 'enabled', !draft.enabled)}
                      activeOpacity={0.85}
                    >
                      <ThemedText style={[styles.statusButtonText, draft.enabled && styles.enabledButtonText]}>
                        {draft.enabled ? t('territories.enabled') : t('territories.disabled')}
                      </ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => handleRemoveTerritory(index)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>

                <TextInput
                  style={styles.input}
                  value={draft.number}
                  onChangeText={(value) => handleChangeDraft(index, 'number', value)}
                  placeholder={t('territories.number')}
                  placeholderTextColor={colors.textDisabled}
                  keyboardType="number-pad"
                />

                <TextInput
                  style={[styles.input, styles.descriptionInput, descriptionTooLong && styles.inputError]}
                  value={draft.description}
                  onChangeText={(value) => handleChangeDraft(index, 'description', value)}
                  placeholder={t('territories.description')}
                  placeholderTextColor={colors.textDisabled}
                  multiline
                  maxLength={TERRITORY_DESCRIPTION_MAX_LENGTH + 20}
                />
                <ThemedText
                  style={[
                    styles.counter,
                    descriptionTooLong && styles.counterError,
                  ]}
                >
                  {draft.description.length}/{TERRITORY_DESCRIPTION_MAX_LENGTH}
                </ThemedText>
              </View>
            );
          })}
        </View>

        {formError ? <ThemedText style={styles.errorText}>{formError}</ThemedText> : null}

        <TouchableOpacity
          style={[styles.primaryButton, (mutations.saving || Boolean(formError)) && styles.disabledButton]}
          onPress={handleSave}
          disabled={mutations.saving || Boolean(formError)}
          activeOpacity={0.85}
        >
          <Ionicons name="save-outline" size={18} color={colors.onPrimary} />
          <ThemedText style={styles.primaryButtonText}>{t('territories.save')}</ThemedText>
        </TouchableOpacity>

        {selectedSchedule ? (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteDay}
            disabled={mutations.saving}
            activeOpacity={0.85}
          >
            <Ionicons name="archive-outline" size={18} color={colors.error} />
            <ThemedText style={styles.deleteButtonText}>{t('territories.deleteDay')}</ThemedText>
          </TouchableOpacity>
        ) : null}
      </View>
    </ScreenContainer>
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
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: '800',
    },
    dayGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    dayButton: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundLight,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    dayButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    dayButtonText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    dayButtonTextActive: {
      color: colors.onPrimary,
    },
    list: {
      gap: 10,
    },
    territoryCard: {
      borderRadius: 10,
      backgroundColor: colors.surfaceRaised,
      padding: 12,
      gap: 10,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
    },
    cardTitle: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    cardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    statusButton: {
      minHeight: 32,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
      backgroundColor: colors.backgroundLight,
    },
    enabledButton: {
      borderColor: colors.success,
      backgroundColor: colors.successLight,
    },
    disabledStatusButton: {
      opacity: 0.8,
    },
    statusButtonText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '800',
    },
    enabledButtonText: {
      color: colors.success,
    },
    iconButton: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundLight,
      borderWidth: 1,
      borderColor: colors.border,
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
    descriptionInput: {
      minHeight: 82,
      paddingTop: 12,
      textAlignVertical: 'top',
    },
    inputError: {
      borderColor: colors.error,
    },
    counter: {
      alignSelf: 'flex-end',
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
    },
    counterError: {
      color: colors.error,
    },
    errorText: {
      color: colors.error,
      fontSize: 12,
      fontWeight: '700',
    },
    primaryButton: {
      minHeight: 50,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    disabledButton: {
      opacity: 0.45,
    },
    deleteButton: {
      minHeight: 46,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.error + '66',
      backgroundColor: colors.errorLight,
      paddingHorizontal: 14,
    },
    deleteButtonText: {
      color: colors.error,
      fontSize: 14,
      fontWeight: '800',
    },
  });
