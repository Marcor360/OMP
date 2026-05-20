import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { EmptyState } from '@/src/components/common/EmptyState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import { useTerritories, useTerritorySchedule } from '@/src/hooks/use-territories';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { TERRITORY_DAY_LABELS, TERRITORY_DAYS, type Territory } from '@/src/types/territory';
import { canManageTerritories } from '@/src/utils/permissions/permissions';

const formatDate = (territory: Territory) => {
  const date = territory.updatedAt?.toDate?.();
  if (!date) return null;

  return new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export function TerritoriesScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { appUser, congregationId, loadingProfile, profileError } = useUser();
  const territoriesState = useTerritories(congregationId);
  const scheduleState = useTerritorySchedule(congregationId);
  const canManage = canManageTerritories(appUser);

  const territoriesById = useMemo(
    () => new Map(territoriesState.activeTerritories.map((territory) => [territory.id, territory])),
    [territoriesState.activeTerritories]
  );

  const scheduleByDay = useMemo(
    () => new Map(scheduleState.schedule.map((item) => [item.dayOfWeek, item])),
    [scheduleState.schedule]
  );

  if (loadingProfile || territoriesState.loading || scheduleState.loading) {
    return <LoadingState message="Cargando territorios..." />;
  }

  if (!appUser || !appUser.isActive || !congregationId) {
    return (
      <ErrorState message={profileError ?? 'Necesitas una cuenta activa con congregacion.'} />
    );
  }

  const error = territoriesState.error ?? scheduleState.error;
  if (error) return <ErrorState message={error} />;

  return (
    <ScreenContainer>
      <PageHeader
        title="Territorios"
        subtitle="Predicacion semanal"
        showBack
        actions={
          canManage ? (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => router.push('/(protected)/preaching/territories/manage' as never)}
              activeOpacity={0.85}
            >
              <Ionicons name="settings-outline" size={18} color={colors.onPrimary} />
            </TouchableOpacity>
          ) : null
        }
      />

      {territoriesState.territories.length === 0 ? (
        <EmptyState
          icon="map-outline"
          title="Sin territorios"
          description="Todavia no hay territorios registrados para esta congregacion."
        />
      ) : (
        <View style={styles.dayList}>
          {TERRITORY_DAYS.map((day) => {
            const schedule = scheduleByDay.get(day);
            const territories = (schedule?.territoryIds ?? [])
              .map((territoryId) => territoriesById.get(territoryId))
              .filter((territory): territory is Territory => Boolean(territory));

            return (
              <View key={day} style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <ThemedText style={styles.dayTitle}>{TERRITORY_DAY_LABELS[day]}</ThemedText>
                  <ThemedText style={styles.countLabel}>
                    {territories.length} {territories.length === 1 ? 'territorio' : 'territorios'}
                  </ThemedText>
                </View>

                {schedule?.note ? (
                  <View style={styles.noteBox}>
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.warning} />
                    <ThemedText style={styles.noteText}>{schedule.note}</ThemedText>
                  </View>
                ) : null}

                {territories.length > 0 ? (
                  <View style={styles.territoryList}>
                    {territories.map((territory) => {
                      const updatedAt = formatDate(territory);
                      return (
                        <View key={territory.id} style={styles.territoryRow}>
                          <View style={styles.territoryIcon}>
                            <Ionicons name="location-outline" size={18} color={colors.primary} />
                          </View>
                          <View style={styles.territoryBody}>
                            <ThemedText style={styles.territoryName}>
                              {territory.number ? `${territory.number}. ` : ''}
                              {territory.name}
                            </ThemedText>
                            {territory.description ? (
                              <ThemedText style={styles.territoryDescription}>
                                {territory.description}
                              </ThemedText>
                            ) : null}
                            {updatedAt ? (
                              <ThemedText style={styles.updatedText}>
                                Actualizado: {updatedAt}
                              </ThemedText>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <ThemedText style={styles.emptyDay}>Sin territorios asignados</ThemedText>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScreenContainer>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    headerButton: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    dayList: {
      gap: 12,
    },
    dayCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 14,
      gap: 10,
    },
    dayHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
    },
    dayTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: '800',
    },
    countLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    noteBox: {
      flexDirection: 'row',
      gap: 8,
      padding: 10,
      borderRadius: 10,
      backgroundColor: colors.warningLight,
    },
    noteText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    territoryList: {
      gap: 8,
    },
    territoryRow: {
      flexDirection: 'row',
      gap: 10,
      padding: 10,
      borderRadius: 10,
      backgroundColor: colors.surfaceRaised,
    },
    territoryIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.infoLight,
    },
    territoryBody: {
      flex: 1,
      minWidth: 0,
    },
    territoryName: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    territoryDescription: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 3,
    },
    updatedText: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 5,
      fontWeight: '600',
    },
    emptyDay: {
      color: colors.textMuted,
      fontSize: 13,
      fontStyle: 'italic',
    },
  });
