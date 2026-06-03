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
import { useVisibleMonthlyTerritories } from '@/src/hooks/use-territories';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import {
  getCurrentMonthId,
  getMonthLabel,
  type Territory,
  type TerritoryAssignmentTarget,
} from '@/src/types/territory';
import { canManageTerritories } from '@/src/utils/permissions/permissions';

export function TerritoriesScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { appUser, uid, congregationId, loadingProfile, profileError } = useUser();
  const monthId = getCurrentMonthId();
  const { data, loading, error } = useVisibleMonthlyTerritories(congregationId, uid, monthId);
  const canManage = canManageTerritories(appUser);
  const congregationCount = data?.congregationTargets.reduce((total, target) => total + target.territoryIds.length, 0) ?? 0;
  const groupCount = data?.groupTargets.reduce((total, target) => total + target.territoryIds.length, 0) ?? 0;

  if (loadingProfile || loading) return <LoadingState message="Cargando territorios..." />;

  if (!appUser || !appUser.isActive || !congregationId) {
    return <ErrorState message={profileError ?? 'Necesitas una cuenta activa con congregacion.'} />;
  }

  if (error) return <ErrorState message={error} />;

  return (
    <ScreenContainer>
      <PageHeader
        title="Territorios"
        subtitle={`Predicacion · ${getMonthLabel(monthId)}`}
        showBack
        actions={
          canManage ? (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => router.push('/(protected)/preaching/territories/manage' as never)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Administrar predicacion"
            >
              <Ionicons name="settings-outline" size={18} color={colors.onPrimary} />
            </TouchableOpacity>
          ) : null
        }
      />

      {congregationCount + groupCount === 0 ? (
        <EmptyState
          icon="map-outline"
          title="Sin territorios asignados"
          description="Todavia no hay territorios de predicacion asignados para este mes."
        />
      ) : (
        <View style={styles.sectionList}>
          <TerritorySection
            title="Para toda la congregacion"
            subtitle={`${congregationCount} ${congregationCount === 1 ? 'territorio' : 'territorios'}`}
            targets={data?.congregationTargets ?? []}
            territoriesById={data?.territoriesById ?? new Map()}
          />

          {data?.userGroup ? (
            <TerritorySection
              title="Mi grupo de predicacion"
              subtitle={`${data.userGroup.name} · ${groupCount} ${groupCount === 1 ? 'territorio' : 'territorios'}`}
              targets={data.groupTargets}
              territoriesById={data.territoriesById}
            />
          ) : null}
        </View>
      )}
    </ScreenContainer>
  );
}

function TerritorySection({
  title,
  subtitle,
  targets,
  territoriesById,
}: {
  title: string;
  subtitle: string;
  targets: TerritoryAssignmentTarget[];
  territoriesById: Map<string, Territory>;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const territories = targets.flatMap((target) =>
    target.territoryIds
      .map((territoryId) => territoriesById.get(territoryId))
      .filter((territory): territory is Territory => Boolean(territory))
  );

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleWrap}>
          <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
          <ThemedText style={styles.sectionSubtitle}>{subtitle}</ThemedText>
        </View>
        <Ionicons name="map-outline" size={20} color={colors.primary} />
      </View>

      {territories.length === 0 ? (
        <ThemedText style={styles.emptyText}>Sin territorios para esta seccion.</ThemedText>
      ) : (
        <View style={styles.territoryList}>
          {territories.map((territory) => (
            <View key={territory.id} style={styles.territoryRow}>
              <View style={styles.territoryIcon}>
                <ThemedText style={styles.territoryNumber}>{territory.number}</ThemedText>
              </View>
              <ThemedText style={styles.territoryDescription}>{territory.description}</ThemedText>
            </View>
          ))}
        </View>
      )}
    </View>
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
    sectionList: {
      gap: 14,
    },
    section: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 14,
      gap: 12,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    sectionTitleWrap: {
      flex: 1,
      minWidth: 0,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: '800',
    },
    sectionSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 2,
    },
    territoryList: {
      gap: 8,
    },
    territoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 10,
      borderRadius: 10,
      backgroundColor: colors.surfaceRaised,
    },
    territoryIcon: {
      minWidth: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.infoLight,
    },
    territoryNumber: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '900',
    },
    territoryDescription: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 19,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 13,
      fontStyle: 'italic',
    },
  });
