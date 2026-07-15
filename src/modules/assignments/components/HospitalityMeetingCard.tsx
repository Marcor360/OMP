import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/src/components/themed-text';
import {
  type HospitalityPlanningRow,
  rolesForMeetingType,
} from '@/src/modules/assignments/hooks/useHospitalityScheduleBuilder';
import type { ActiveCongregationUser } from '@/src/services/users/active-users-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import type { HospitalityOptionalRoles, HospitalityRoleKey } from '@/src/types/hospitality-microphones';

type HospitalityMeetingCardProps = {
  row: HospitalityPlanningRow;
  optionalRoles: HospitalityOptionalRoles;
  usersById: Map<string, ActiveCongregationUser>;
  expanded: boolean;
  published: boolean;
  disabled?: boolean;
  midweekLabel: string;
  weekendLabel: string;
  unassignedLabel: string;
  substituteLabel: string;
  formatDate: (dateKey: string) => string;
  roleLabel: (roleKey: HospitalityRoleKey) => string;
  conflictFor: (row: HospitalityPlanningRow, roleKey: HospitalityRoleKey) => string | undefined;
  onToggle: () => void;
  onSelectRole: (row: HospitalityPlanningRow, roleKey: HospitalityRoleKey) => void;
};

export function HospitalityMeetingCard({
  row,
  optionalRoles,
  usersById,
  expanded,
  published,
  disabled,
  midweekLabel,
  weekendLabel,
  unassignedLabel,
  substituteLabel,
  formatDate,
  roleLabel,
  conflictFor,
  onToggle,
  onSelectRole,
}: HospitalityMeetingCardProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const roles = rolesForMeetingType(row.meetingType, optionalRoles);
  const assigned = roles.filter((role) => Boolean(row.assignments[role])).length;
  const progressColor = assigned === roles.length
    ? colors.success
    : assigned > 0
      ? colors.warning
      : colors.textMuted;

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.header}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${formatDate(row.meetingDate)}, ${row.meetingType === 'midweek' ? midweekLabel : weekendLabel}`}
        accessibilityState={{ expanded }}
      >
        <View style={styles.headerText}>
          <ThemedText style={styles.date}>{formatDate(row.meetingDate)}</ThemedText>
          <View style={styles.metaRow}>
            <View style={styles.badge}>
              <ThemedText style={styles.badgeText}>
                {row.meetingType === 'midweek' ? midweekLabel : weekendLabel}
              </ThemedText>
            </View>
            <ThemedText style={styles.meetingTitle} numberOfLines={1}>{row.meetingTitle}</ThemedText>
          </View>
        </View>
        <View style={[styles.progress, { borderColor: progressColor }]}>
          <ThemedText style={[styles.progressText, { color: progressColor }]}>{assigned}/{roles.length}</ThemedText>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.roles}>
          {roles.map((roleKey) => {
            const userId = row.assignments[roleKey];
            const selectedName = userId ? usersById.get(userId)?.displayName : undefined;
            const conflict = conflictFor(row, roleKey);
            return (
              <TouchableOpacity
                key={roleKey}
                style={[styles.roleRow, conflict && styles.roleRowConflict]}
                onPress={() => onSelectRole(row, roleKey)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={`${roleLabel(roleKey)}, ${formatDate(row.meetingDate)}`}
              >
                <View style={styles.roleText}>
                  <ThemedText style={styles.roleTitle}>{roleLabel(roleKey)}</ThemedText>
                  <ThemedText style={[styles.assignee, !selectedName && styles.unassigned]} numberOfLines={1}>
                    {selectedName ?? unassignedLabel}
                  </ThemedText>
                  {conflict ? <ThemedText style={styles.conflict}>{conflict}</ThemedText> : null}
                </View>
                {published ? (
                  <ThemedText style={styles.substitute}>{substituteLabel}</ThemedText>
                ) : (
                  <Ionicons name="person-add-outline" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppColorSet) => StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface, overflow: 'hidden' },
  header: { minHeight: 78, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerText: { flex: 1, gap: 7 },
  date: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.backgroundLight },
  badgeText: { color: colors.textSecondary, fontSize: 10, fontWeight: '700' },
  meetingTitle: { flex: 1, color: colors.textMuted, fontSize: 11 },
  progress: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  progressText: { fontSize: 11, fontWeight: '900' },
  roles: { borderTopWidth: 1, borderTopColor: colors.border },
  roleRow: { minHeight: 62, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  roleRowConflict: { backgroundColor: `${colors.error}0D` },
  roleText: { flex: 1, gap: 2 },
  roleTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  assignee: { color: colors.textSecondary, fontSize: 12 },
  unassigned: { color: colors.textMuted, fontStyle: 'italic' },
  conflict: { color: colors.error, fontSize: 10, fontWeight: '700' },
  substitute: { color: colors.primary, fontSize: 11, fontWeight: '800' },
});
