import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppColors } from '@/src/styles';

interface CleaningMemberItemProps {
  uid: string;
  displayName: string;
  email?: string;
  department?: string;
  onRemove?: (uid: string) => void;
  removing?: boolean;
}

/** Ítem de integrante en la lista del detalle de grupo. */
export function CleaningMemberItem({
  uid,
  displayName,
  email,
  department,
  onRemove,
  removing = false,
}: CleaningMemberItemProps) {
  const colors = useAppColors();

  // Iniciales del usuario para el avatar
  const initials = displayName
    .trim()
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 4,
      gap: 12,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: `${colors.primary}20`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initials: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
    },
    info: {
      flex: 1,
    },
    name: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    sub: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 1,
    },
    removeBtn: {
      padding: 6,
      borderRadius: 8,
    },
    separator: {
      height: 1,
      backgroundColor: colors.divider,
      marginLeft: 52,
    },
  });

  return (
    <>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.initials}>{initials}</Text>
        </View>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          {(department ?? email) && (
            <Text style={styles.sub} numberOfLines={1}>
              {department ?? email}
            </Text>
          )}
        </View>

        {onRemove && (
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => onRemove(uid)}
            disabled={removing}
            accessibilityRole="button"
            accessibilityLabel={`Quitar a ${displayName} del grupo`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {removing ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Ionicons name="remove-circle-outline" size={22} color={colors.error} />
            )}
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.separator} />
    </>
  );
}
