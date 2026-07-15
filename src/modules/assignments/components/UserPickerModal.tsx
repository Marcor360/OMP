import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/src/components/themed-text';
import type { ActiveCongregationUser } from '@/src/services/users/active-users-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

type UserPickerModalProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  users: ActiveCongregationUser[];
  selectedUserId?: string;
  disabledReasons?: Record<string, string>;
  allowClear?: boolean;
  clearLabel: string;
  searchPlaceholder: string;
  closeLabel: string;
  availableLabel: string;
  selectedLabel: string;
  onClose: () => void;
  onSelect: (user?: ActiveCongregationUser) => void;
};

const normalizeSearch = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();

const initials = (name: string): string => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part.charAt(0).toUpperCase())
  .join('');

export function UserPickerModal({
  visible,
  title,
  subtitle,
  users,
  selectedUserId,
  disabledReasons = {},
  allowClear = true,
  clearLabel,
  searchPlaceholder,
  closeLabel,
  availableLabel,
  selectedLabel,
  onClose,
  onSelect,
}: UserPickerModalProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const [search, setSearch] = useState('');
  const filteredUsers = useMemo(() => {
    const query = normalizeSearch(search);
    const matches = query
      ? users.filter((user) => normalizeSearch(`${user.displayName} ${user.email ?? ''}`).includes(query))
      : users;
    return [...matches].sort((left, right) => {
      if (left.uid === selectedUserId) return -1;
      if (right.uid === selectedUserId) return 1;
      return left.displayName.localeCompare(right.displayName, 'es');
    });
  }, [search, selectedUserId, users]);

  const close = () => {
    setSearch('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerText}>
              <ThemedText style={styles.title}>{title}</ThemedText>
              {subtitle ? <ThemedText style={styles.subtitle}>{subtitle}</ThemedText> : null}
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.textDisabled}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          {allowClear ? (
            <TouchableOpacity style={styles.clearOption} onPress={() => onSelect(undefined)}>
              <Ionicons name="remove-circle-outline" size={20} color={colors.textMuted} />
              <ThemedText style={styles.clearText}>{clearLabel}</ThemedText>
            </TouchableOpacity>
          ) : null}

          <FlatList
            data={filteredUsers}
            keyExtractor={(user) => user.uid}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const selected = item.uid === selectedUserId;
              const disabledReason = disabledReasons[item.uid];
              return (
                <TouchableOpacity
                  style={[styles.userRow, selected && styles.userRowSelected, disabledReason && styles.userRowDisabled]}
                  disabled={Boolean(disabledReason)}
                  onPress={() => onSelect(item)}
                  accessibilityRole="button"
                  accessibilityLabel={item.displayName}
                  accessibilityState={{ selected, disabled: Boolean(disabledReason) }}
                >
                  <View style={[styles.avatar, selected && styles.avatarSelected]}>
                    <ThemedText style={[styles.avatarText, selected && styles.avatarTextSelected]}>
                      {initials(item.displayName)}
                    </ThemedText>
                  </View>
                  <View style={styles.userText}>
                    <ThemedText style={styles.userName}>{item.displayName}</ThemedText>
                    <ThemedText style={[styles.userMeta, disabledReason && styles.warning]} numberOfLines={1}>
                      {disabledReason ?? item.email ?? (selected ? selectedLabel : availableLabel)}
                    </ThemedText>
                  </View>
                  <Ionicons
                    name={disabledReason ? 'lock-closed-outline' : selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={disabledReason ? colors.textDisabled : selected ? colors.primary : colors.textMuted}
                  />
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: AppColorSet) => StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    padding: Platform.OS === 'web' ? 24 : 0,
  },
  sheet: {
    width: '100%',
    maxWidth: 720,
    height: Platform.OS === 'web' ? '82%' : '88%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: Platform.OS === 'web' ? 20 : 0,
    borderBottomRightRadius: Platform.OS === 'web' ? 20 : 0,
    overflow: 'hidden',
  },
  handle: { width: 34, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerText: { flex: 1, gap: 2 },
  title: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 12 },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  searchWrap: { margin: 12, minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.backgroundLight },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14, paddingVertical: 10, outlineStyle: 'none' } as never,
  clearOption: { minHeight: 44, marginHorizontal: 12, marginBottom: 6, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, backgroundColor: colors.backgroundLight },
  clearText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  listContent: { paddingHorizontal: 12, paddingBottom: 20 },
  userRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 8, paddingHorizontal: 6 },
  userRowSelected: { backgroundColor: `${colors.primary}0D` },
  userRowDisabled: { opacity: 0.55 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backgroundLight },
  avatarSelected: { backgroundColor: `${colors.primary}22` },
  avatarText: { color: colors.textSecondary, fontSize: 12, fontWeight: '800' },
  avatarTextSelected: { color: colors.primary },
  userText: { flex: 1, gap: 2 },
  userName: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  userMeta: { color: colors.textMuted, fontSize: 11 },
  warning: { color: colors.warning, fontWeight: '700' },
});
