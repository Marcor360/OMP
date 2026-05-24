import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { EmptyState } from '@/src/components/common/EmptyState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import { useI18n } from '@/src/i18n/index';
import { useTerritorySchedule } from '@/src/hooks/use-territories';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { TERRITORY_DAY_LABELS, TERRITORY_DAYS } from '@/src/types/territory';
import { canManageTerritories } from '@/src/utils/permissions/permissions';

export function TerritoriesScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { t } = useI18n();
  const { appUser, congregationId, loadingProfile, profileError } = useUser();
  const { schedule, scheduleByDay, loading, error } = useTerritorySchedule(congregationId);
  const canManage = canManageTerritories(appUser);
  const totalTerritories = schedule.reduce(
    (total, day) => total + day.territories.filter((territory) => territory.enabled).length,
    0
  );

  if (loadingProfile || loading) {
    return <LoadingState message={t('territories.loading')} />;
  }

  if (!appUser || !appUser.isActive || !congregationId) {
    return (
      <ErrorState message={profileError ?? t('territories.activeAccountRequired')} />
    );
  }

  if (error) return <ErrorState message={error} />;

  return (
    <ScreenContainer>
      <PageHeader
        title={t('territories.title')}
        subtitle={t('territories.weekSubtitle')}
        showBack
        actions={
          canManage ? (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => router.push('/(protected)/territories/manage' as never)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('territories.manageTitle')}
            >
              <Ionicons name="settings-outline" size={18} color={colors.onPrimary} />
            </TouchableOpacity>
          ) : null
        }
      />

      {totalTerritories === 0 ? (
        <EmptyState
          icon="map-outline"
          title={t('territories.emptyTitle')}
          description={t('territories.empty')}
        />
      ) : (
        <View style={styles.dayList}>
          {TERRITORY_DAYS.map((day) => {
            const territories = scheduleByDay
              .get(day)
              ?.territories.filter((territory) => territory.enabled) ?? [];

            return (
              <View key={day} style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <ThemedText style={styles.dayTitle}>{TERRITORY_DAY_LABELS[day]}</ThemedText>
                  <ThemedText style={styles.countLabel}>
                    {territories.length} {territories.length === 1 ? t('territories.countOne') : t('territories.countMany')}
                  </ThemedText>
                </View>

                {territories.length > 0 ? (
                  <View style={styles.territoryList}>
                    {territories.map((territory) => (
                      <View key={`${day}:${territory.number}`} style={styles.territoryRow}>
                        <View style={styles.territoryIcon}>
                          <Ionicons name="map-outline" size={18} color={colors.primary} />
                        </View>
                        <View style={styles.territoryBody}>
                          <ThemedText style={styles.territoryName}>
                            {t('territories.itemTitle', { number: territory.number })}
                          </ThemedText>
                          <ThemedText style={styles.territoryDescription}>
                            {territory.description}
                          </ThemedText>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <ThemedText style={styles.emptyDay}>{t('territories.emptyDay')}</ThemedText>
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
    emptyDay: {
      color: colors.textMuted,
      fontSize: 13,
      fontStyle: 'italic',
    },
  });
