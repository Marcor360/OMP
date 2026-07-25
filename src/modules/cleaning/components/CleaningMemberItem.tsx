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
import { useI18n } from '@/src/i18n/index';

interface CleaningMemberItemProps {
  uid: string;
  displayName: string;
  email?: string;
  department?: string;
  onRemove?: (uid: string) => void;
  removing?: boolean;
  disabled?: boolean;
  showSeparator?: boolean;
}

/** Ítem de integrante en la lista del detalle de grupo. */
export function CleaningMemberItem({
  uid,
  displayName,
  email,
  department,
  onRemove,
  removing = false,
  disabled = false,
  showSeparator = true,
}: CleaningMemberItemProps) {
  const colors = useAppColors();
  const { t } = useI18n();

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
      opacity: disabled && !removing ? 0.5 : 1,
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
            <Text style={styles.sub} numberOfLines={1} ellipsizeMode="middle">
              {department ?? email}
            </Text>
          )}
        </View>

        {onRemove && (
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => onRemove(uid)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={t('cleaning.removeMemberA11y', { name: displayName })}
            accessibilityState={{ disabled }}
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
      {showSeparator ? <View style={styles.separator} /> : null}
    </>
  );
}
