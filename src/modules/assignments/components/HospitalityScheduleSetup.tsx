import { ScrollView, StyleSheet, Switch, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/src/components/themed-text';
import { WEEKDAYS } from '@/src/modules/assignments/hooks/useHospitalityScheduleBuilder';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import type { HospitalityOptionalRoles, HospitalitySchedule } from '@/src/types/hospitality-microphones';
import { confirmAlert } from '@/src/utils/ui/alerts';

type Props = {
  title: string;
  startDate: string;
  endDate: string;
  midweekDay: number;
  weekendDay: number;
  optionalRoles: HospitalityOptionalRoles;
  schedules: HospitalitySchedule[];
  selectedScheduleId?: string;
  busy: boolean;
  canEdit: boolean;
  canPublish: boolean;
  labels: {
    workList: string; titlePlaceholder: string; microphoneThree: string; attendantExtra: string;
    midweekDay: string; weekendDay: string; generate: string; generating: string; load: string;
    published: string; draft: string; archive: string; archiveConfirmTitle: string;
    archiveDraftConfirm: string; archivePublishedConfirm: string; archiveConfirmAction: string;
    cancel: string;
  };
  weekdayLabel: (weekday: typeof WEEKDAYS[number]) => string;
  onTitleChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onMidweekDayChange: (value: number) => void;
  onWeekendDayChange: (value: number) => void;
  onOptionalRolesChange: (value: HospitalityOptionalRoles) => void;
  onGenerate: () => void;
  onLoad: () => void;
  onOpenSchedule: (schedule: HospitalitySchedule) => void;
  onArchiveSchedule: (schedule: HospitalitySchedule) => void;
  generating: boolean;
};

export const canArchiveHospitalitySchedule = (
  status: HospitalitySchedule['status'],
  canEdit: boolean,
  canPublish: boolean
): boolean =>
  (status === 'draft' && canEdit)
  || (status === 'published' && canPublish);

export function HospitalityScheduleSetup(props: Props) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const requestArchive = async (schedule: HospitalitySchedule) => {
    const confirmed = await confirmAlert({
      title: props.labels.archiveConfirmTitle,
      message: schedule.status === 'published'
        ? props.labels.archivePublishedConfirm
        : props.labels.archiveDraftConfirm,
      confirmLabel: props.labels.archiveConfirmAction,
      cancelLabel: props.labels.cancel,
      destructive: true,
    });
    if (confirmed) props.onArchiveSchedule(schedule);
  };
  const dayPicker = (kind: 'midweek' | 'weekend', selected: number, onChange: (day: number) => void) => (
    <View style={styles.dayGroup}>
      <ThemedText style={styles.label}>{kind === 'midweek' ? props.labels.midweekDay : props.labels.weekendDay}</ThemedText>
      <View style={styles.dayOptions}>
        {WEEKDAYS.map((weekday, index) => (
          <TouchableOpacity
            key={`${kind}-${weekday}`}
            style={[styles.dayOption, selected === index && styles.dayOptionSelected]}
            onPress={() => onChange(index)}
            accessibilityRole="button"
            accessibilityState={{ selected: selected === index }}
          >
            <ThemedText style={[styles.dayText, selected === index && styles.dayTextSelected]}>
              {props.weekdayLabel(weekday)}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.stack}>
      <View style={styles.panel}>
        <ThemedText style={styles.title}>{props.labels.workList}</ThemedText>
        <TextInput style={styles.input} value={props.title} onChangeText={props.onTitleChange} placeholder={props.labels.titlePlaceholder} placeholderTextColor={colors.textDisabled} />
        <View style={styles.dateRow}>
          <TextInput style={[styles.input, styles.dateInput]} value={props.startDate} onChangeText={props.onStartDateChange} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textDisabled} autoCapitalize="none" />
          <TextInput style={[styles.input, styles.dateInput]} value={props.endDate} onChangeText={props.onEndDateChange} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textDisabled} autoCapitalize="none" />
        </View>
        <View style={styles.switches}>
          <View style={styles.switchRow}>
            <ThemedText style={styles.label}>{props.labels.microphoneThree}</ThemedText>
            <Switch value={props.optionalRoles.microphoneThree} onValueChange={(value) => props.onOptionalRolesChange({ ...props.optionalRoles, microphoneThree: value })} trackColor={{ false: colors.border, true: `${colors.primary}60` }} thumbColor={props.optionalRoles.microphoneThree ? colors.primary : colors.textDisabled} />
          </View>
          <View style={styles.switchRow}>
            <ThemedText style={styles.label}>{props.labels.attendantExtra}</ThemedText>
            <Switch value={props.optionalRoles.attendantExtra} onValueChange={(value) => props.onOptionalRolesChange({ ...props.optionalRoles, attendantExtra: value })} trackColor={{ false: colors.border, true: `${colors.primary}60` }} thumbColor={props.optionalRoles.attendantExtra ? colors.primary : colors.textDisabled} />
          </View>
        </View>
        <View style={styles.days}>{dayPicker('midweek', props.midweekDay, props.onMidweekDayChange)}{dayPicker('weekend', props.weekendDay, props.onWeekendDayChange)}</View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={props.onGenerate} disabled={props.busy}>
            <Ionicons name="calendar-number-outline" size={16} color={colors.primary} />
            <ThemedText style={styles.secondaryText}>{props.generating ? props.labels.generating : props.labels.generate}</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={props.onLoad} disabled={props.busy}>
            <Ionicons name="refresh-outline" size={16} color={colors.primary} />
            <ThemedText style={styles.secondaryText}>{props.labels.load}</ThemedText>
          </TouchableOpacity>
        </View>
      </View>

      {props.schedules.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {props.schedules.map((schedule) => (
            <View key={schedule.id} style={[styles.chip, props.selectedScheduleId === schedule.id && styles.chipSelected]}>
              <TouchableOpacity style={styles.chipOpen} onPress={() => props.onOpenSchedule(schedule)}>
                <ThemedText style={styles.chipTitle} numberOfLines={1}>{schedule.title}</ThemedText>
                <ThemedText style={styles.chipMeta}>{schedule.startDate} – {schedule.endDate}</ThemedText>
                <ThemedText style={[styles.chipStatus, schedule.status === 'published' && styles.published]}>{schedule.status === 'published' ? props.labels.published : props.labels.draft}</ThemedText>
              </TouchableOpacity>
              {canArchiveHospitalitySchedule(
                schedule.status,
                props.canEdit,
                props.canPublish
              ) ? (
                <TouchableOpacity
                  style={styles.archiveButton}
                  onPress={() => void requestArchive(schedule)}
                  disabled={props.busy}
                  accessibilityRole="button"
                  accessibilityLabel={`${props.labels.archive}: ${schedule.title}`}
                >
                  <Ionicons name="archive-outline" size={14} color={colors.error} />
                  <ThemedText style={styles.archiveText}>{props.labels.archive}</ThemedText>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppColorSet) => StyleSheet.create({
  stack: { gap: 12 },
  panel: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface, padding: 14, gap: 12 },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
  input: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, color: colors.textPrimary, backgroundColor: colors.backgroundLight, outlineStyle: 'none' } as never,
  dateRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  dateInput: { flex: 1, minWidth: 150 },
  switches: { gap: 8 },
  switchRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  dayGroup: { flex: 1, minWidth: 250, gap: 7 },
  dayOptions: { flexDirection: 'row', gap: 5 },
  dayOption: { flex: 1, minHeight: 34, borderWidth: 1, borderColor: colors.border, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backgroundLight },
  dayOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  dayText: { color: colors.textSecondary, fontSize: 10, fontWeight: '700' },
  dayTextSelected: { color: colors.onPrimary },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  secondaryButton: { minHeight: 42, flex: 1, minWidth: 190, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.primary, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  secondaryText: { color: colors.primary, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  chips: { gap: 8 },
  chip: { width: 210, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, overflow: 'hidden' },
  chipOpen: { padding: 10, gap: 3 },
  chipSelected: { borderColor: colors.primary, backgroundColor: `${colors.primary}0D` },
  chipTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '800' },
  chipMeta: { color: colors.textMuted, fontSize: 10 },
  chipStatus: { color: colors.warning, fontSize: 10, fontWeight: '800' },
  published: { color: colors.success },
  archiveButton: { minHeight: 34, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  archiveText: { color: colors.error, fontSize: 10, fontWeight: '800' },
});
