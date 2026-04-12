import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppColors } from '@/src/styles';
import {
  CleaningAssignableUser,
  CleaningMemberStatus,
  CLEANING_MEMBER_STATUS_LABELS,
} from '@/src/modules/cleaning/types/cleaning-group.types';

interface CleaningUserSelectItemProps {
  user: CleaningAssignableUser;
  selected: boolean;
  onToggle: (uid: string) => void;
}

// Colores y íconos por estado
const STATUS_ICON: Record<CleaningMemberStatus, React.ComponentProps<typeof Ionicons>['name']> = {
  available: 'ellipse-outline',
  assigned_here: 'checkmark-circle',
  assigned_other: 'lock-closed-outline',
  inactive: 'ban-outline',
  not_eligible: 'close-circle-outline',
};

/** Ítem de usuario en el selector modal de integrantes. */
export function CleaningUserSelectItem({
  user,
  selected,
  onToggle,
}: CleaningUserSelectItemProps) {
  const colors = useAppColors();

  const isDisabled =
    user.memberStatus === 'assigned_other' ||
    user.memberStatus === 'inactive' ||
    user.memberStatus === 'not_eligible';

  const isInGroup = user.memberStatus === 'assigned_here';

  const resolveStatusColor = (): string => {
    switch (user.memberStatus) {
      case 'available': return colors.success;
      case 'assigned_here': return colors.primary;
      case 'assigned_other': return colors.warning;
      case 'inactive':
      case 'not_eligible': return colors.textDisabled;
    }
  };

  const statusColor = resolveStatusColor();

  const initials = user.displayName
    .trim()
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      gap: 12,
      opacity: isDisabled && !isInGroup ? 0.55 : 1,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: isDisabled && !isInGroup
        ? colors.surfaceRaised
        : `${statusColor}20`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initials: {
      fontSize: 13,
      fontWeight: '700',
      color: isDisabled && !isInGroup ? colors.textDisabled : statusColor,
    },
    info: {
      flex: 1,
    },
    name: {
      fontSize: 14,
      fontWeight: '600',
      color: isDisabled ? colors.textMuted : colors.textPrimary,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    statusLabel: {
      fontSize: 11,
      color: statusColor,
      fontWeight: '500',
    },
    checkboxArea: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    separator: {
      height: 1,
      backgroundColor: colors.divider,
      marginLeft: 66,
    },
  });

  const subtitle =
    user.memberStatus === 'assigned_other' && user.cleaningGroupName
      ? `Asignado a: ${user.cleaningGroupName}`
      : CLEANING_MEMBER_STATUS_LABELS[user.memberStatus];

  return (
    <>
      <TouchableOpacity
        style={styles.row}
        onPress={() => !isDisabled && !isInGroup && onToggle(user.uid)}
        disabled={isDisabled || isInGroup}
        activeOpacity={0.7}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected || isInGroup, disabled: isDisabled }}
        accessibilityLabel={`${user.displayName} - ${subtitle}`}
      >
        <View style={styles.avatar}>
          <Text style={styles.initials}>{initials}</Text>
        </View>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {user.displayName}
          </Text>
          <View style={styles.statusRow}>
            <Ionicons
              name={STATUS_ICON[user.memberStatus]}
              size={11}
              color={statusColor}
            />
            <Text style={styles.statusLabel} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        </View>

        <View style={styles.checkboxArea}>
          {isInGroup ? (
            <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
          ) : isDisabled ? (
            <Ionicons name="lock-closed-outline" size={18} color={colors.textDisabled} />
          ) : selected ? (
            <Ionicons name="checkbox" size={22} color={colors.primary} />
          ) : (
            <Ionicons name="square-outline" size={22} color={colors.textMuted} />
          )}
        </View>
      </TouchableOpacity>
      <View style={styles.separator} />
    </>
  );
}
