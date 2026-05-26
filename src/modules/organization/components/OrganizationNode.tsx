import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import { UserIcon } from '@/src/modules/organization/components/UserIcon';
import type { OrganizationTreeNode } from '@/src/modules/organization/types/organization.types';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

type OrganizationNodeProps = {
  node: OrganizationTreeNode;
  isRoot?: boolean;
  canEdit?: boolean;
  compact?: boolean;
  onEdit?: (node: OrganizationTreeNode) => void;
};

export function OrganizationNode({
  node,
  isRoot = false,
  canEdit = false,
  compact = false,
  onEdit,
}: OrganizationNodeProps) {
  const colors = useAppColors();
  const styles = createStyles(colors, compact);
  const isDepartment = node.type === 'department';

  return (
    <View
      style={[
        styles.card,
        isDepartment ? styles.departmentCard : styles.personCard,
        isRoot && styles.rootCard,
      ]}
    >
      <View style={styles.row}>
        {isDepartment ? (
          <View style={styles.departmentIcon}>
            <Ionicons name="business-outline" size={18} color={colors.primary} />
          </View>
        ) : (
          <View style={styles.userIcon}>
            <UserIcon size={18} color={colors.primary} />
          </View>
        )}

        <View style={styles.content}>
          <ThemedText style={styles.name} numberOfLines={2}>
            {node.displayName}
          </ThemedText>
          <ThemedText style={styles.title} numberOfLines={2}>
            {node.title}
          </ThemedText>
        </View>

        {canEdit ? (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => onEdit?.(node)}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {node.departmentName ? (
        <View style={styles.badge}>
          <ThemedText style={styles.badgeText} numberOfLines={1}>
            {isDepartment ? 'Departamento' : node.departmentName}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppColorSet, compact: boolean) =>
  StyleSheet.create({
    card: {
      width: compact ? '100%' : 220,
      minHeight: compact ? 82 : 96,
      borderRadius: 16,
      borderWidth: 1,
      padding: 12,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    personCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    departmentCard: {
      backgroundColor: colors.primary + '12',
      borderColor: colors.primary + '55',
    },
    rootCard: {
      borderColor: colors.primary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    userIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary + '18',
    },
    departmentIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    content: {
      flex: 1,
      minWidth: 0,
    },
    name: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    title: {
      marginTop: 2,
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    editButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary + '12',
    },
    badge: {
      alignSelf: 'flex-start',
      marginTop: 10,
      maxWidth: '100%',
      borderRadius: 999,
      backgroundColor: colors.surfaceRaised,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    badgeText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
    },
  });
