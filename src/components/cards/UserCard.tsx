import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/src/components/themed-text';
import { StatusBadge, roleColor, userStatusColor } from '@/src/components/common/StatusBadge';
import { AppColors } from '@/src/constants/app-colors';
import { AppUser, ROLE_LABELS, STATUS_LABELS } from '@/src/types/user';

interface UserCardProps {
  user: AppUser;
  onPress?: () => void;
}

export function UserCard({ user, onPress }: UserCardProps) {
  const router = useRouter();

  const initials = user.displayName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push(`/(protected)/users/${user.uid}` as any);
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.8}>
      <View style={[styles.avatar, { backgroundColor: roleColor[user.role] + '33' }]}>
        <ThemedText style={[styles.initials, { color: roleColor[user.role] }]}>
          {initials}
        </ThemedText>
      </View>

      <View style={styles.info}>
        <ThemedText style={styles.name} numberOfLines={1}>
          {user.displayName}
        </ThemedText>
        <ThemedText style={styles.email} numberOfLines={1}>
          {user.email}
        </ThemedText>
        <View style={styles.badges}>
          <StatusBadge
            label={ROLE_LABELS[user.role]}
            color={roleColor[user.role]}
            size="sm"
          />
          <StatusBadge
            label={STATUS_LABELS[user.status]}
            color={userStatusColor[user.status]}
            size="sm"
          />
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={AppColors.textDisabled} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontSize: 16,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.textPrimary,
  },
  email: {
    fontSize: 13,
    color: AppColors.textMuted,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
});
