import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { PreachingGroupUserPickerModal } from '@/src/components/preaching/PreachingGroupUserPickerModal';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import {
  useActiveCongregationUsers,
  useMonthlyTerritoryAssignment,
  usePreachingGroups,
  useTerritoriesCatalog,
  useTerritoryMutations,
} from '@/src/hooks/use-territories';
import { useI18n } from '@/src/i18n/index';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import {
  buildTerritoryId,
  getCurrentMonthId,
  getMonthLabel,
  TERRITORY_DESCRIPTION_MAX_LENGTH,
  type PreachingGroup,
  type Territory,
  type TerritoryAssignmentTarget,
} from '@/src/types/territory';
import type { AppUser } from '@/src/types/user';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import {
  canAssignMonthlyTerritories,
  canManagePreachingGroups,
  canManageTerritoryCatalog,
} from '@/src/utils/permissions/permissions';

type TabKey = 'territories' | 'groups' | 'monthly';
type GroupPicker = 'captain' | 'assistant' | 'members';

type TerritoryDraft = {
  id?: string;
  number: string;
  description: string;
};

type GroupDraft = {
  id?: string;
  number: string;
  captainUserId: string;
  assistantUserId: string;
  memberIds: string[];
};

const emptyTerritoryDraft = (): TerritoryDraft => ({ number: '', description: '' });
const emptyGroupDraft = (): GroupDraft => ({ number: '', captainUserId: '', assistantUserId: '', memberIds: [] });

export function TerritoriesManageScreen() {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { appUser, uid, congregationId, loadingProfile } = useUser();
  const [tab, setTab] = useState<TabKey>('territories');
  const monthId = getCurrentMonthId();
  const catalog = useTerritoriesCatalog(congregationId);
  const groups = usePreachingGroups(congregationId);
  const monthly = useMonthlyTerritoryAssignment(congregationId, monthId);
  const users = useActiveCongregationUsers(congregationId);
  const mutations = useTerritoryMutations(congregationId, uid);

  const canCatalog = canManageTerritoryCatalog(appUser);
  const canGroups = canManagePreachingGroups(appUser);
  const canAssign = canAssignMonthlyTerritories(appUser);
  const canManageAny = canCatalog || canGroups || canAssign;
  const loading = loadingProfile || catalog.loading || groups.loading || monthly.loading || users.loading;
  const error = catalog.error ?? groups.error ?? monthly.error ?? users.error;

  if (loading) return <LoadingState message="Cargando administracion de predicacion..." />;
  if (!appUser || !canManageAny) return <ErrorState message="No tienes permisos para administrar predicacion." />;
  if (error) return <ErrorState message={error} />;

  return (
    <ScreenContainer>
      <PageHeader title="Administrar predicacion" showBack />

      <View style={styles.tabs}>
        <TabButton label="Territorios" active={tab === 'territories'} onPress={() => setTab('territories')} />
        <TabButton label="Grupos" active={tab === 'groups'} onPress={() => setTab('groups')} />
        <TabButton label="Asignacion mensual" active={tab === 'monthly'} onPress={() => setTab('monthly')} />
      </View>

      {tab === 'territories' ? (
        <TerritoryCatalogSection
          territories={catalog.territories}
          canManage={canCatalog}
          saving={mutations.saving}
          onSave={async (draft) => {
            try {
              const input = {
                number: Number(draft.number.trim()),
                description: draft.description.trim(),
                status: 'active' as const,
              };
              if (draft.id) await mutations.updateTerritory(draft.id, input);
              else await mutations.createTerritory(input);
              Alert.alert('Territorios', 'Territorio guardado correctamente.');
            } catch (saveError) {
              Alert.alert('Error', formatFirestoreError(saveError));
            }
          }}
          onDeactivate={async (territoryId) => {
            try {
              await mutations.deactivateTerritory(territoryId);
            } catch (saveError) {
              Alert.alert('Error', formatFirestoreError(saveError));
            }
          }}
        />
      ) : null}

      {tab === 'groups' ? (
        <GroupsSection
          groups={groups.groups}
          users={users.users}
          canManage={canGroups}
          saving={mutations.saving}
          onSave={async (draft) => {
            try {
              const selectedUsers = users.users.filter((user) => draft.memberIds.includes(user.uid));
              const captain = users.users.find((user) => user.uid === draft.captainUserId);
              const assistant = users.users.find((user) => user.uid === draft.assistantUserId);
              const input = {
                number: Number(draft.number.trim()),
                captainUserId: draft.captainUserId,
                captainName: captain?.displayName ?? '',
                assistantUserId: assistant?.uid ?? null,
                assistantName: assistant?.displayName ?? null,
                memberIds: draft.memberIds,
                memberNames: selectedUsers.map((user) => user.displayName),
                isActive: true,
              };
              if (draft.id) await mutations.updatePreachingGroup(draft.id, input);
              else await mutations.createPreachingGroup(input);
              Alert.alert('Grupos', 'Grupo guardado correctamente.');
              return true;
            } catch (saveError) {
              Alert.alert('Error', formatFirestoreError(saveError));
              return false;
            }
          }}
          onDeactivate={async (groupId) => {
            try {
              await mutations.deactivatePreachingGroup(groupId);
            } catch (saveError) {
              Alert.alert('Error', formatFirestoreError(saveError));
            }
          }}
        />
      ) : null}

      {tab === 'monthly' ? (
        <MonthlyAssignmentSection
          monthId={monthId}
          territories={catalog.territories}
          groups={groups.groups}
          existingTargets={monthly.assignment?.assignments ?? []}
          canManage={canAssign}
          saving={mutations.saving}
          onSave={async (targets) => {
            try {
              await mutations.upsertMonthlyTerritoryAssignment(monthId, { assignments: targets });
              await monthly.refresh();
              Alert.alert('Asignacion mensual', 'Asignacion mensual guardada.');
            } catch (saveError) {
              Alert.alert('Error', formatFirestoreError(saveError));
            }
          }}
        />
      ) : null}
    </ScreenContainer>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  return (
    <TouchableOpacity style={[styles.tabButton, active && styles.tabButtonActive]} onPress={onPress}>
      <ThemedText style={[styles.tabText, active && styles.tabTextActive]}>{label}</ThemedText>
    </TouchableOpacity>
  );
}

function TerritoryCatalogSection({
  territories,
  canManage,
  saving,
  onSave,
  onDeactivate,
}: {
  territories: Territory[];
  canManage: boolean;
  saving: boolean;
  onSave: (draft: TerritoryDraft) => Promise<void>;
  onDeactivate: (territoryId: string) => Promise<void>;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const [draft, setDraft] = useState<TerritoryDraft>(emptyTerritoryDraft());
  const activeTerritories = territories.filter((territory) => territory.status === 'active');
  const descriptionTooLong = draft.description.length > TERRITORY_DESCRIPTION_MAX_LENGTH;

  if (!canManage) return <ErrorState message="No tienes permisos para administrar el catalogo." />;

  return (
    <View style={styles.stack}>
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>{draft.id ? 'Editar territorio' : 'Nuevo territorio'}</ThemedText>
        <TextInput
          style={styles.input}
          value={draft.number}
          onChangeText={(number) => setDraft((current) => ({ ...current, number }))}
          placeholder="Numero"
          placeholderTextColor={colors.textDisabled}
          keyboardType="number-pad"
          editable={!draft.id}
        />
        <TextInput
          style={[styles.input, styles.descriptionInput, descriptionTooLong && styles.inputError]}
          value={draft.description}
          onChangeText={(description) => setDraft((current) => ({ ...current, description }))}
          placeholder="Descripcion corta"
          placeholderTextColor={colors.textDisabled}
          multiline
          maxLength={TERRITORY_DESCRIPTION_MAX_LENGTH + 20}
        />
        <ThemedText style={[styles.counter, descriptionTooLong && styles.errorText]}>
          {draft.description.length}/{TERRITORY_DESCRIPTION_MAX_LENGTH}
        </ThemedText>
        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.disabledButton]}
          disabled={saving}
          onPress={async () => {
            await onSave(draft);
            setDraft(emptyTerritoryDraft());
          }}
        >
          <Ionicons name="save-outline" size={18} color={colors.onPrimary} />
          <ThemedText style={styles.primaryButtonText}>Guardar territorio</ThemedText>
        </TouchableOpacity>
      </View>

      <View style={styles.list}>
        {activeTerritories.map((territory) => (
          <View key={territory.id} style={styles.card}>
            <View style={styles.cardText}>
              <ThemedText style={styles.cardTitle}>Territorio {territory.number}</ThemedText>
              <ThemedText style={styles.cardSubtitle}>{territory.description}</ThemedText>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.iconButton} onPress={() => setDraft({ id: territory.id, number: String(territory.number), description: territory.description })}>
                <Ionicons name="create-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={() => void onDeactivate(territory.id)}>
                <Ionicons name="archive-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function GroupsSection({
  groups,
  users,
  canManage,
  saving,
  onSave,
  onDeactivate,
}: {
  groups: PreachingGroup[];
  users: AppUser[];
  canManage: boolean;
  saving: boolean;
  onSave: (draft: GroupDraft) => Promise<boolean>;
  onDeactivate: (groupId: string) => Promise<void>;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { t } = useI18n();
  const [draft, setDraft] = useState<GroupDraft>(emptyGroupDraft());
  const [picker, setPicker] = useState<GroupPicker | null>(null);
  const activeGroups = groups.filter((group) => group.isActive);
  const captain = users.find((user) => user.uid === draft.captainUserId);
  const assistant = users.find((user) => user.uid === draft.assistantUserId);

  if (!canManage) return <ErrorState message="No tienes permisos para administrar grupos." />;

  const selectedIds = picker === 'captain'
    ? draft.captainUserId ? [draft.captainUserId] : []
    : picker === 'assistant'
      ? draft.assistantUserId ? [draft.assistantUserId] : []
      : draft.memberIds;
  const lockedReasons: Record<string, string> = {};
  if (picker === 'assistant' && draft.captainUserId) {
    lockedReasons[draft.captainUserId] = t('preachingGroups.isCaptain');
  }
  if (picker === 'members') {
    if (draft.captainUserId) {
      lockedReasons[draft.captainUserId] = t('preachingGroups.captainLocked');
    }
    if (draft.assistantUserId) {
      lockedReasons[draft.assistantUserId] = t('preachingGroups.assistantLocked');
    }
  }

  return (
    <View style={styles.stack}>
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>{draft.id ? 'Editar grupo' : 'Nuevo grupo'}</ThemedText>
        <TextInput
          style={styles.input}
          value={draft.number}
          onChangeText={(number) => setDraft((current) => ({ ...current, number }))}
          placeholder="Numero de grupo"
          placeholderTextColor={colors.textDisabled}
          keyboardType="number-pad"
        />
        <SelectionField
          label={t('preachingGroups.captain')}
          value={captain?.displayName}
          placeholder={t('preachingGroups.selectCaptain')}
          icon="person-outline"
          onPress={() => setPicker('captain')}
        />
        <SelectionField
          label={t('preachingGroups.assistant')}
          value={assistant?.displayName}
          placeholder={t('preachingGroups.selectAssistant')}
          icon="person-add-outline"
          onPress={() => setPicker('assistant')}
          onClear={draft.assistantUserId
            ? () => setDraft((current) => ({ ...current, assistantUserId: '' }))
            : undefined}
        />
        <SelectionField
          label={t('preachingGroups.members')}
          value={draft.memberIds.length > 0
            ? t('preachingGroups.membersSelected', { count: draft.memberIds.length })
            : undefined}
          placeholder={t('preachingGroups.selectMembers')}
          icon="people-outline"
          onPress={() => setPicker('members')}
        />
        <TouchableOpacity
          style={[
            styles.primaryButton,
            (saving || !draft.number.trim() || !draft.captainUserId) && styles.disabledButton,
          ]}
          disabled={saving || !draft.number.trim() || !draft.captainUserId}
          onPress={async () => {
            const saved = await onSave(draft);
            if (saved) setDraft(emptyGroupDraft());
          }}
        >
          <Ionicons name="save-outline" size={18} color={colors.onPrimary} />
          <ThemedText style={styles.primaryButtonText}>Guardar grupo</ThemedText>
        </TouchableOpacity>
      </View>

      <View style={styles.list}>
        {activeGroups.map((group) => (
          <View key={group.id} style={styles.card}>
            <View style={styles.cardText}>
              <ThemedText style={styles.cardTitle}>{group.name}</ThemedText>
              <ThemedText style={styles.cardSubtitle}>
                Capitan: {group.captainName} · {group.memberCount} integrantes
              </ThemedText>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setDraft({
                  id: group.id,
                  number: String(group.number),
                  captainUserId: group.captainUserId,
                  assistantUserId: group.assistantUserId ?? '',
                  memberIds: group.memberIds,
                })}
              >
                <Ionicons name="create-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={() => void onDeactivate(group.id)}>
                <Ionicons name="archive-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      <PreachingGroupUserPickerModal
        visible={picker !== null}
        title={
          picker === 'captain'
            ? t('preachingGroups.selectCaptain')
            : picker === 'assistant'
              ? t('preachingGroups.selectAssistant')
              : t('preachingGroups.selectMembers')
        }
        users={users}
        groups={activeGroups}
        currentGroupId={draft.id}
        selectedIds={selectedIds}
        multiple={picker === 'members'}
        lockedReasons={lockedReasons}
        onClose={() => setPicker(null)}
        onConfirm={(ids) => {
          if (picker === 'captain') {
            const captainUserId = ids[0] ?? '';
            setDraft((current) => ({
              ...current,
              captainUserId,
              assistantUserId:
                current.assistantUserId === captainUserId ? '' : current.assistantUserId,
              memberIds: captainUserId
                ? Array.from(new Set([...current.memberIds, captainUserId]))
                : current.memberIds,
            }));
          } else if (picker === 'assistant') {
            const assistantUserId = ids[0] ?? '';
            setDraft((current) => ({
              ...current,
              assistantUserId,
              memberIds: assistantUserId
                ? Array.from(new Set([...current.memberIds, assistantUserId]))
                : current.memberIds,
            }));
          } else if (picker === 'members') {
            setDraft((current) => ({
              ...current,
              memberIds: Array.from(
                new Set([
                  ...ids,
                  ...(current.captainUserId ? [current.captainUserId] : []),
                  ...(current.assistantUserId ? [current.assistantUserId] : []),
                ])
              ),
            }));
          }
          setPicker(null);
        }}
      />
    </View>
  );
}

function SelectionField({
  label,
  value,
  placeholder,
  icon,
  onPress,
  onClear,
}: {
  label: string;
  value?: string;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  onClear?: () => void;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { t } = useI18n();

  return (
    <View style={styles.selectionGroup}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <View style={styles.selectionField}>
        <TouchableOpacity
          style={styles.selectionMain}
          onPress={onPress}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value ?? placeholder}`}
        >
          <View style={styles.selectionIcon}>
            <Ionicons name={icon} size={18} color={colors.primary} />
          </View>
          <ThemedText
            style={[styles.selectionValue, !value && styles.selectionPlaceholder]}
            numberOfLines={1}
          >
            {value ?? placeholder}
          </ThemedText>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        {onClear ? (
          <TouchableOpacity
            style={styles.clearSelection}
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel={t('preachingGroups.clearSelection', { role: label.toLowerCase() })}
          >
            <Ionicons name="close-circle" size={19} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function MonthlyAssignmentSection({
  monthId,
  territories,
  groups,
  existingTargets,
  canManage,
  saving,
  onSave,
}: {
  monthId: string;
  territories: Territory[];
  groups: PreachingGroup[];
  existingTargets: TerritoryAssignmentTarget[];
  canManage: boolean;
  saving: boolean;
  onSave: (targets: TerritoryAssignmentTarget[]) => Promise<void>;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const activeTerritories = territories.filter((territory) => territory.status === 'active');
  const activeGroups = groups.filter((group) => group.isActive);
  const existingCongregationIds = existingTargets.find((target) => target.scope === 'congregation')?.territoryIds ?? [];
  const [congregationIds, setCongregationIds] = useState<string[]>(existingCongregationIds);
  const [groupIdsByGroup, setGroupIdsByGroup] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      existingTargets
        .filter((target) => target.scope === 'group' && target.groupId)
        .map((target) => [target.groupId as string, target.territoryIds])
    )
  );

  if (!canManage) return <ErrorState message="No tienes permisos para asignar territorios." />;

  const toggle = (items: string[], territoryId: string) =>
    items.includes(territoryId) ? items.filter((item) => item !== territoryId) : [...items, territoryId];

  const buildTargets = (): TerritoryAssignmentTarget[] => {
    const targets: TerritoryAssignmentTarget[] = [];
    if (congregationIds.length > 0) {
      targets.push({
        id: 'congregation',
        scope: 'congregation',
        groupId: null,
        groupName: null,
        territoryIds: congregationIds,
        territoryNumbers: [],
        notes: null,
      });
    }
    activeGroups.forEach((group) => {
      const territoryIds = groupIdsByGroup[group.id] ?? [];
      if (territoryIds.length === 0) return;
      targets.push({
        id: `group_${group.id}`,
        scope: 'group',
        groupId: group.id,
        groupName: group.name,
        territoryIds,
        territoryNumbers: [],
        notes: null,
      });
    });
    return targets;
  };

  const selectedGlobally = new Set([
    ...congregationIds,
    ...Object.values(groupIdsByGroup).flat(),
  ]);

  return (
    <View style={styles.stack}>
      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Asignacion mensual</ThemedText>
        <ThemedText style={styles.cardSubtitle}>{getMonthLabel(monthId)}</ThemedText>
      </View>

      <AssignmentPicker
        title="Para toda la congregacion"
        territories={activeTerritories}
        selectedIds={congregationIds}
        disabledIds={selectedGlobally}
        onToggle={(territoryId) => setCongregationIds((current) => toggle(current, territoryId))}
      />

      {activeGroups.map((group) => (
        <AssignmentPicker
          key={group.id}
          title={group.name}
          territories={activeTerritories}
          selectedIds={groupIdsByGroup[group.id] ?? []}
          disabledIds={selectedGlobally}
          onToggle={(territoryId) => setGroupIdsByGroup((current) => ({ ...current, [group.id]: toggle(current[group.id] ?? [], territoryId) }))}
        />
      ))}

      <TouchableOpacity
        style={[styles.primaryButton, saving && styles.disabledButton]}
        disabled={saving}
        onPress={() => void onSave(buildTargets())}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.onPrimary} />
        <ThemedText style={styles.primaryButtonText}>Guardar asignacion mensual</ThemedText>
      </TouchableOpacity>
    </View>
  );
}

function AssignmentPicker({
  title,
  territories,
  selectedIds,
  disabledIds,
  onToggle,
}: {
  title: string;
  territories: Territory[];
  selectedIds: string[];
  disabledIds: Set<string>;
  onToggle: (territoryId: string) => void;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      <View style={styles.chipWrap}>
        {territories.map((territory) => {
          const selected = selectedIds.includes(territory.id);
          const disabled = disabledIds.has(territory.id) && !selected;
          return (
            <TouchableOpacity
              key={territory.id}
              style={[styles.chip, selected && styles.chipActive, disabled && styles.disabledButton]}
              disabled={disabled}
              onPress={() => onToggle(territory.id)}
            >
              <ThemedText style={[styles.chipText, selected && styles.chipTextActive]}>
                {buildTerritoryId(territory.number).replace('territory_', '#')}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    tabs: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 14,
    },
    tabButton: {
      minHeight: 38,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tabText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    tabTextActive: {
      color: colors.onPrimary,
    },
    stack: {
      gap: 12,
    },
    section: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 14,
      gap: 10,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '800',
    },
    label: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '800',
    },
    selectionGroup: {
      gap: 6,
    },
    selectionField: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundLight,
      paddingHorizontal: 12,
    },
    selectionMain: {
      flex: 1,
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    selectionIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary + '16',
    },
    selectionValue: {
      flex: 1,
      minWidth: 0,
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    selectionPlaceholder: {
      color: colors.textMuted,
      fontWeight: '600',
    },
    clearSelection: {
      padding: 4,
    },
    input: {
      minHeight: 46,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundLight,
      color: colors.textPrimary,
      paddingHorizontal: 12,
      fontSize: 14,
    },
    descriptionInput: {
      minHeight: 82,
      paddingTop: 12,
      textAlignVertical: 'top',
    },
    inputError: {
      borderColor: colors.error,
    },
    counter: {
      alignSelf: 'flex-end',
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
    },
    errorText: {
      color: colors.error,
    },
    primaryButton: {
      minHeight: 50,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    disabledButton: {
      opacity: 0.45,
    },
    list: {
      gap: 10,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 12,
    },
    cardText: {
      flex: 1,
      minWidth: 0,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    cardSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 2,
    },
    cardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.infoLight,
    },
    chipText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '800',
    },
    chipTextActive: {
      color: colors.primary,
    },
  });
