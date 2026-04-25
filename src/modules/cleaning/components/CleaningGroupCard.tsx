import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppColors } from '@/src/styles';
import { CleaningGroup } from '@/src/modules/cleaning/types/cleaning-group.types';

interface CleaningGroupCardProps {
  group: CleaningGroup;
  onPress: (group: CleaningGroup) => void;
}

/** Tarjeta que resume un grupo de limpieza en el listado del dashboard. */
export function CleaningGroupCard({ group, onPress }: CleaningGroupCardProps) {
  const colors = useAppColors();

  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
      elevation: 2,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 8,
    },
    iconWrapper: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: `${colors.primary}20`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      flex: 1,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '600',
    },
    description: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 18,
      marginBottom: 12,
    },
    typeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: `${colors.primary}12`,
      marginBottom: 10,
    },
    typeText: {
      fontSize: 11,
      color: colors.primary,
      fontWeight: '700',
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    memberCount: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    chevron: {
      opacity: 0.4,
    },
  });

  const isActive = group.isActive;
  const isFamilyGroup = group.groupType === 'family';
  const statusBg = isActive ? colors.successLight : colors.surfaceRaised;
  const statusColor = isActive ? colors.success : colors.textMuted;
  const statusLabel = isActive ? 'Activo' : 'Inactivo';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(group)}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Grupo de limpieza: ${group.name}`}
    >
      <View style={styles.header}>
        <View style={styles.nameRow}>
          <View style={styles.iconWrapper}>
            <Ionicons
              name={isFamilyGroup ? 'home-outline' : 'sparkles-outline'}
              size={18}
              color={colors.primary}
            />
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {group.name}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {group.description.length > 0 && (
        <Text style={styles.description} numberOfLines={2}>
          {group.description}
        </Text>
      )}

      {isFamilyGroup ? (
        <View style={styles.typeBadge}>
          <Ionicons name="home-outline" size={12} color={colors.primary} />
          <Text style={styles.typeText}>Grupo familiar</Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.memberRow}>
          <Ionicons name="people-outline" size={14} color={colors.textMuted} />
          <Text style={styles.memberCount}>
            {group.memberCount} {group.memberCount === 1 ? 'integrante' : 'integrantes'}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.textMuted}
          style={styles.chevron}
        />
      </View>
    </TouchableOpacity>
  );
}
