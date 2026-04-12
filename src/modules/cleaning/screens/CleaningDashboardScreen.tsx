import React, { useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAppColors } from '@/src/styles';
import { useCleaningPermission } from '@/src/modules/cleaning/hooks/use-cleaning-permission';
import { useCleaningGroups } from '@/src/modules/cleaning/hooks/use-cleaning-groups';
import { CleaningGroupCard } from '@/src/modules/cleaning/components/CleaningGroupCard';
import { CleaningStatsCard } from '@/src/modules/cleaning/components/CleaningStatsCard';
import { CleaningGroup } from '@/src/modules/cleaning/types/cleaning-group.types';
import { LoadingState } from '@/src/components/common/LoadingState';
import { ErrorState } from '@/src/components/common/ErrorState';
import { EmptyState } from '@/src/components/common/EmptyState';

type FilterType = 'all' | 'active' | 'inactive';

/** Pantalla principal del módulo de limpieza. */
export function CleaningDashboardScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const { congregationId, loading: permLoading } = useCleaningPermission();
  const { groups, loading, error, refresh } = useCleaningGroups(congregationId);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    refresh();
    setRefreshing(false);
  };

  // Estadísticas calculadas localmente
  const stats = useMemo(() => {
    const activeGroups = groups.filter((g) => g.isActive);
    const totalAssigned = activeGroups.reduce((sum, g) => sum + g.memberCount, 0);
    return {
      totalGroups: groups.length,
      activeGroups: activeGroups.length,
      totalAssigned,
    };
  }, [groups]);

  // Filtrado y búsqueda
  const filtered = useMemo(() => {
    let result = groups;
    if (filter === 'active') result = result.filter((g) => g.isActive);
    if (filter === 'inactive') result = result.filter((g) => !g.isActive);

    const q = search.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.description.toLowerCase().includes(q)
      );
    }

    return result;
  }, [groups, filter, search]);

  const handleGroupPress = (group: CleaningGroup) => {
    router.push(`/(protected)/cleaning/${group.id}`);
  };

  const handleCreate = () => {
    router.push('/(protected)/cleaning/create');
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundDark,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    headerSub: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
    },
    createBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 20,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.textPrimary,
      paddingVertical: 11,
    },
    filterRow: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      gap: 8,
      marginBottom: 16,
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
    },
    filterChipText: {
      fontSize: 13,
      fontWeight: '600',
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginHorizontal: 20,
      marginBottom: 8,
    },
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 100,
    },
    emptyWrapper: {
      paddingTop: 40,
    },
  });

  const filterOptions: { label: string; value: FilterType }[] = [
    { label: 'Todos', value: 'all' },
    { label: 'Activos', value: 'active' },
    { label: 'Inactivos', value: 'inactive' },
  ];

  if (permLoading || loading) return <LoadingState message="Cargando módulo de limpieza..." />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Limpieza</Text>
          <Text style={styles.headerSub}>
            {stats.totalGroups} grupo{stats.totalGroups !== 1 ? 's' : ''} registrado
            {stats.totalGroups !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={handleCreate}
          accessibilityRole="button"
          accessibilityLabel="Crear nuevo grupo de limpieza"
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Estadísticas */}
      <View style={styles.statsRow}>
        <CleaningStatsCard
          icon="layers-outline"
          label="Total grupos"
          value={stats.totalGroups}
          color={colors.primary}
        />
        <CleaningStatsCard
          icon="checkmark-circle-outline"
          label="Activos"
          value={stats.activeGroups}
          color={colors.success}
        />
        <CleaningStatsCard
          icon="people-outline"
          label="Asignados"
          value={stats.totalAssigned}
          color={colors.info}
        />
      </View>

      {/* Buscador */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar grupo..."
          placeholderTextColor={colors.textDisabled}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Buscar grupo de limpieza"
        />
      </View>

      {/* Filtros */}
      <View style={styles.filterRow}>
        {filterOptions.map((opt) => {
          const active = filter === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? `${colors.primary}15` : 'transparent',
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setFilter(opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: active ? colors.primary : colors.textMuted },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Lista de grupos */}
      <Text style={styles.sectionLabel}>Grupos de limpieza</Text>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CleaningGroupCard group={item} onPress={handleGroupPress} />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrapper}>
            <EmptyState
              title={
                search || filter !== 'all'
                  ? 'Sin resultados'
                  : 'Sin grupos de limpieza'
              }
              description={
                search || filter !== 'all'
                  ? 'Prueba ajustando el filtro o la búsqueda.'
                  : 'Crea el primer grupo usando el botón +.'
              }
              icon="sparkles-outline"
            />
          </View>
        }
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}
