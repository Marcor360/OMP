import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import {
  buildCommonRoles,
  type HospitalityPlanningRow,
  type HospitalityWeekGroup,
} from '@/src/modules/assignments/hooks/useHospitalityScheduleBuilder';
import type { ActiveCongregationUser } from '@/src/services/users/active-users-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import type { HospitalityOptionalRoles, HospitalityRoleKey } from '@/src/types/hospitality-microphones';

type GridColumn = HospitalityRoleKey | 'reader';

type HospitalityRoleGridProps = {
  weeks: HospitalityWeekGroup[];
  optionalRoles: HospitalityOptionalRoles;
  usersById: Map<string, ActiveCongregationUser>;
  published: boolean;
  disabled?: boolean;
  dateColumnLabel: string;
  readerLabel: string;
  unassignedLabel: string;
  formatDate: (dateKey: string) => string;
  roleLabel: (roleKey: HospitalityRoleKey) => string;
  conflictFor: (row: HospitalityPlanningRow, roleKey: HospitalityRoleKey) => string | undefined;
  onSelectRole: (row: HospitalityPlanningRow, roleKey: HospitalityRoleKey) => void;
};

const actualRole = (row: HospitalityPlanningRow, column: GridColumn): HospitalityRoleKey =>
  column === 'reader'
    ? row.meetingType === 'midweek' ? 'midweekBibleStudyReader' : 'watchtowerReader'
    : column;

export function HospitalityRoleGrid({
  weeks,
  optionalRoles,
  usersById,
  published,
  disabled,
  dateColumnLabel,
  readerLabel,
  unassignedLabel,
  formatDate,
  roleLabel,
  conflictFor,
  onSelectRole,
}: HospitalityRoleGridProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const columns: GridColumn[] = [...buildCommonRoles(optionalRoles), 'reader'];
  const gridWidth = 168 + columns.length * 132;

  return (
    <View style={styles.frame}>
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ minWidth: gridWidth }}>
        <View style={{ minWidth: gridWidth }}>
          <View style={styles.header}>
            <View style={[styles.headerCell, styles.dateCell]}>
              <ThemedText style={styles.headerText}>{dateColumnLabel}</ThemedText>
            </View>
            {columns.map((column) => (
              <View key={column} style={styles.headerCell}>
                <ThemedText style={styles.headerText} numberOfLines={2}>
                  {column === 'reader' ? readerLabel : roleLabel(column)}
                </ThemedText>
              </View>
            ))}
          </View>

          {weeks.map((week) => (
            <View key={week.key}>
              <View style={styles.weekSeparator}>
                <ThemedText style={styles.weekText}>{week.label}</ThemedText>
              </View>
              {week.rows.map((row) => (
                <View key={row.meetingId} style={styles.row}>
                  <View style={[styles.cell, styles.dateCell]}>
                    <ThemedText style={styles.dateText}>{formatDate(row.meetingDate)}</ThemedText>
                    <ThemedText style={styles.typeText} numberOfLines={1}>{row.meetingTitle}</ThemedText>
                  </View>
                  {columns.map((column) => {
                    const roleKey = actualRole(row, column);
                    const userId = row.assignments[roleKey];
                    const selectedName = userId ? usersById.get(userId)?.displayName : undefined;
                    const conflict = conflictFor(row, roleKey);
                    return (
                      <TouchableOpacity
                        key={`${row.meetingId}-${column}`}
                        style={[styles.cell, styles.clickableCell, conflict && styles.conflictCell]}
                        onPress={() => onSelectRole(row, roleKey)}
                        disabled={disabled}
                        accessibilityRole="button"
                        accessibilityLabel={`${roleLabel(roleKey)}, ${formatDate(row.meetingDate)}`}
                      >
                        <ThemedText style={[styles.userName, !selectedName && styles.unassigned]} numberOfLines={2}>
                          {selectedName ?? unassignedLabel}
                        </ThemedText>
                        {conflict ? <ThemedText style={styles.conflict} numberOfLines={2}>{conflict}</ThemedText> : null}
                        {published && selectedName ? <ThemedText style={styles.editHint}>↻</ThemedText> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: AppColorSet) => StyleSheet.create({
  frame: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    position: 'sticky',
    top: 0,
    zIndex: 4,
  } as never,
  headerCell: { width: 132, minHeight: 58, padding: 8, justifyContent: 'center', borderRightWidth: 1, borderRightColor: colors.border },
  headerText: { color: colors.textSecondary, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  dateCell: { width: 168, alignItems: 'flex-start' },
  weekSeparator: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: `${colors.primary}12`, borderBottomWidth: 1, borderBottomColor: colors.border },
  weekText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  row: { flexDirection: 'row', minHeight: 72, borderBottomWidth: 1, borderBottomColor: colors.border },
  cell: { width: 132, minHeight: 72, padding: 8, justifyContent: 'center', borderRightWidth: 1, borderRightColor: colors.border },
  clickableCell: { alignItems: 'center' },
  conflictCell: { backgroundColor: `${colors.error}0D` },
  dateText: { color: colors.textPrimary, fontSize: 12, fontWeight: '800' },
  typeText: { color: colors.textMuted, fontSize: 10, marginTop: 3 },
  userName: { color: colors.textPrimary, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  unassigned: { color: colors.textMuted, fontWeight: '500', fontStyle: 'italic' },
  conflict: { color: colors.error, fontSize: 9, fontWeight: '700', textAlign: 'center', marginTop: 3 },
  editHint: { color: colors.primary, fontSize: 12, marginTop: 3 },
});
