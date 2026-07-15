import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/src/i18n/index';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import type { PreachingGroup } from '@/src/types/territory';

export type PreachingGroupPickerUser = {
  uid: string;
  displayName: string;
  email?: string | null;
};

type PreachingGroupUserPickerModalProps = {
  visible: boolean;
  title: string;
  users: PreachingGroupPickerUser[];
  groups: PreachingGroup[];
  currentGroupId?: string;
  selectedIds: string[];
  multiple?: boolean;
  lockedReasons?: Record<string, string>;
  onConfirm: (selectedIds: string[]) => void;
  onClose: () => void;
};

type PickerUserState = 'available' | 'current_group' | 'selected' | 'assigned_other' | 'locked';

const getInitials = (displayName: string): string =>
  displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

export function PreachingGroupUserPickerModal({
  visible,
  title,
  users,
  groups,
  currentGroupId,
  selectedIds,
  multiple = false,
  lockedReasons = {},
  onConfirm,
  onClose,
}: PreachingGroupUserPickerModalProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [draftIds, setDraftIds] = useState<string[]>(selectedIds);
  const selectedIdsKey = selectedIds.join('\u0000');

  useEffect(() => {
    if (visible) {
      setDraftIds(selectedIdsKey ? selectedIdsKey.split('\u0000') : []);
      return;
    }
    setSearch('');
  }, [selectedIdsKey, visible]);

  const activeGroups = useMemo(() => groups.filter((group) => group.isActive), [groups]);
  const currentGroup = useMemo(
    () => activeGroups.find((group) => group.id === currentGroupId) ?? null,
    [activeGroups, currentGroupId]
  );

  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    return users
      .map((user) => {
        const otherGroup = activeGroups.find(
          (group) => group.id !== currentGroupId && group.memberIds.includes(user.uid)
        );
        const selected = draftIds.includes(user.uid);
        const lockedReason = lockedReasons[user.uid];
        const state: PickerUserState = otherGroup
          ? 'assigned_other'
          : lockedReason
            ? 'locked'
            : selected
              ? 'selected'
              : currentGroup?.memberIds.includes(user.uid)
                ? 'current_group'
                : 'available';

        return { user, otherGroup, lockedReason, selected, state };
      })
      .filter(({ user }) => {
        if (!query) return true;
        return (
          user.displayName.toLocaleLowerCase().includes(query) ||
          (user.email ?? '').toLocaleLowerCase().includes(query)
        );
      })
      .sort((left, right) => {
        const rank: Record<PickerUserState, number> = {
          selected: 0,
          locked: 1,
          current_group: 2,
          available: 3,
          assigned_other: 4,
        };
        return rank[left.state] - rank[right.state] ||
          left.user.displayName.localeCompare(right.user.displayName);
      });
  }, [activeGroups, currentGroup, currentGroupId, draftIds, lockedReasons, search, users]);

  const toggleUser = (uid: string) => {
    if (multiple) {
      setDraftIds((current) =>
        current.includes(uid) ? current.filter((id) => id !== uid) : [...current, uid]
      );
      return;
    }
    setDraftIds([uid]);
  };

  const getStatePresentation = (
    state: PickerUserState,
    otherGroupName?: string,
    lockedReason?: string
  ): { label: string; color: string; icon: keyof typeof Ionicons.glyphMap } => {
    switch (state) {
      case 'assigned_other':
        return {
          label: t('preachingGroups.assignedTo', { group: otherGroupName ?? '' }),
          color: colors.warning,
          icon: 'lock-closed-outline',
        };
      case 'locked':
        return {
          label: lockedReason ?? t('preachingGroups.selectionLocked'),
          color: colors.primary,
          icon: 'lock-closed-outline',
        };
      case 'selected':
        return {
          label: t('preachingGroups.selected'),
          color: colors.primary,
          icon: 'checkmark-circle',
        };
      case 'current_group':
        return {
          label: t('preachingGroups.inCurrentGroup'),
          color: colors.primary,
          icon: 'people-outline',
        };
      case 'available':
        return {
          label: t('preachingGroups.available'),
          color: colors.success,
          icon: 'ellipse-outline',
        };
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.keyboardWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={16} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder={t('preachingGroups.searchUser')}
                placeholderTextColor={colors.textDisabled}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>

            <FlatList
              data={rows}
              keyExtractor={({ user }) => user.uid}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={rows.length === 0 ? styles.emptyList : undefined}
              ListEmptyComponent={
                <Text style={styles.emptyText}>{t('preachingGroups.noUsersFound')}</Text>
              }
              renderItem={({ item }) => {
                const presentation = getStatePresentation(
                  item.state,
                  item.otherGroup?.name,
                  item.lockedReason
                );
                const disabled = item.state === 'assigned_other' || item.state === 'locked';

                return (
                  <TouchableOpacity
                    style={[styles.userRow, disabled && styles.userRowDisabled]}
                    disabled={disabled}
                    onPress={() => toggleUser(item.user.uid)}
                    accessibilityRole={multiple ? 'checkbox' : 'radio'}
                    accessibilityState={{ checked: item.selected, disabled }}
                    accessibilityLabel={`${item.user.displayName}. ${presentation.label}`}
                  >
                    <View style={[styles.avatar, { backgroundColor: `${presentation.color}20` }]}>
                      <Text style={[styles.initials, { color: presentation.color }]}>
                        {getInitials(item.user.displayName)}
                      </Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {item.user.displayName}
                      </Text>
                      {item.user.email ? (
                        <Text style={styles.userEmail} numberOfLines={1}>
                          {item.user.email}
                        </Text>
                      ) : null}
                      <View style={styles.statusRow}>
                        <Ionicons
                          name={presentation.icon}
                          size={11}
                          color={presentation.color}
                        />
                        <Text
                          style={[styles.statusText, { color: presentation.color }]}
                          numberOfLines={1}
                        >
                          {presentation.label}
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name={
                        disabled
                          ? 'lock-closed-outline'
                          : item.selected
                            ? multiple
                              ? 'checkbox'
                              : 'radio-button-on'
                            : multiple
                              ? 'square-outline'
                              : 'radio-button-off'
                      }
                      size={21}
                      color={disabled ? colors.textDisabled : item.selected ? colors.primary : colors.textMuted}
                    />
                  </TouchableOpacity>
                );
              }}
            />

            <View style={styles.footer}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => {
                  const assignedToOtherGroup = new Set(
                    activeGroups
                      .filter((group) => group.id !== currentGroupId)
                      .flatMap((group) => group.memberIds)
                  );
                  onConfirm(draftIds.filter((uid) => !assignedToOtherGroup.has(uid)));
                }}
                accessibilityRole="button"
                accessibilityLabel={t('preachingGroups.confirmSelection')}
              >
                <Text style={styles.confirmText}>
                  {multiple
                    ? t('preachingGroups.confirmMembers', { count: draftIds.length })
                    : t('preachingGroups.confirmSelection')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    keyboardWrap: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    sheet: {
      width: '100%',
      maxWidth: 760,
      height: '86%',
      alignSelf: 'center',
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: 'hidden',
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 4,
    },
    header: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    title: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: '800',
    },
    closeButton: {
      padding: 6,
    },
    searchBar: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      margin: 14,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 14,
      paddingVertical: 10,
    },
    userRow: {
      minHeight: 66,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    userRowDisabled: {
      opacity: 0.55,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initials: {
      fontSize: 13,
      fontWeight: '800',
    },
    userInfo: {
      flex: 1,
      minWidth: 0,
    },
    userName: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    userEmail: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 1,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    statusText: {
      flex: 1,
      fontSize: 11,
      fontWeight: '600',
    },
    emptyList: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: 'center',
      padding: 24,
    },
    footer: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    cancelButton: {
      flex: 1,
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
    },
    cancelText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '700',
    },
    confirmButton: {
      flex: 2,
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    confirmText: {
      color: colors.onPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
  });
