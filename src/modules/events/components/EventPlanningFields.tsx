import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { DatePickerModal } from '@/src/components/forms/DatePickerModal';
import { ThemedText } from '@/src/components/themed-text';
import {
  buildEventShifts, DEFAULT_EVENT_TEAM_SIZE, EVENT_LIMITS, type EventPerson, type EventSchedule, type EventTeam,
} from '@/functions/src/shared/event-planning';
import { useI18n } from '@/src/i18n';
import { listEventPlanningPeople } from '@/src/services/events/event-planning-service';
import { useAppColors } from '@/src/styles';
import { confirmAlert } from '@/src/utils/ui/alerts';

export const eventFieldStyles = StyleSheet.create({
  section: { gap: 12, padding: 14, borderWidth: 1, borderRadius: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  group: { gap: 8 },
  title: { fontSize: 17, fontWeight: '700' },
  field: { gap: 5, minWidth: 120, flexGrow: 1 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  message: { fontSize: 13 },
  shift: { gap: 8, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
});

export function EventButton({ label, accessibilityLabel, onPress, disabled, selected, primary }: {
  label: string; accessibilityLabel?: string; onPress: () => void; disabled?: boolean; selected?: boolean; primary?: boolean;
}) {
  const colors = useAppColors();
  const webToggle = Platform.OS === 'web' && selected !== undefined ? { 'aria-pressed': selected } : {};
  return (
    <Pressable
      {...webToggle}
      accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled, selected }} onPress={onPress} disabled={disabled}
      style={({ pressed }) => [eventFieldStyles.input, {
        borderColor: selected || primary ? colors.primary : colors.border,
        backgroundColor: primary ? colors.primary : selected ? colors.primary + '18' : colors.surface,
        justifyContent: 'center', opacity: disabled || pressed ? 0.58 : 1,
      }]}
    >
      <ThemedText style={{ color: primary ? colors.onPrimary : colors.textPrimary, fontWeight: '700' }}>{label}</ThemedText>
    </Pressable>
  );
}

export function EventField({ label, children }: { label: string; children: ReactNode }) {
  return <View style={eventFieldStyles.field}><ThemedText>{label}</ThemedText>{children}</View>;
}

export function EventText({ label, ...props }: TextInputProps & { label: string }) {
  const colors = useAppColors();
  return (
    <EventField label={label}>
      <TextInput {...props} accessibilityLabel={label} placeholderTextColor={colors.textMuted}
        style={[eventFieldStyles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }, props.style]} />
    </EventField>
  );
}

export function EventDate({ label, value, minimum, maximum, onChange, disabled }: {
  label: string; value: string; minimum?: string; maximum?: string; onChange: (date: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <EventField label={label}>
      <EventButton label={value ? `${label} · ${value}` : label} disabled={disabled} onPress={() => setOpen(true)} />
      {open && <DatePickerModal visible selectedDate={value || null} minDate={minimum} maxDate={maximum}
        title={label} onSelectDate={onChange} onClose={() => setOpen(false)} />}
    </EventField>
  );
}

export function EventSection({ children }: { children: ReactNode }) {
  const colors = useAppColors();
  return <View style={[eventFieldStyles.section, { borderColor: colors.border, backgroundColor: colors.surface }]}>{children}</View>;
}

export function useEventPeople(congregationId: string, initialPeople: EventPerson[] = []) {
  const [people, setPeople] = useState(initialPeople);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const requested = useRef(false);
  const load = useCallback(async () => {
    if (requested.current) return;
    requested.current = true;
    setStatus('loading');
    try {
      setPeople(await listEventPlanningPeople(congregationId));
      setStatus('ready');
    } catch {
      requested.current = false;
      setStatus('error');
    }
  }, [congregationId]);
  return { people, status, load };
}

export function PeoplePicker({ title, value, max, source, onClose, onChange }: {
  title: string; value: string[]; max: number; source: ReturnType<typeof useEventPeople>;
  onClose: () => void; onChange: (ids: string[]) => void;
}) {
  const { t } = useI18n();
  const colors = useAppColors();
  const [search, setSearch] = useState('');
  const searchKey = (text: string) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const visiblePeople = source.people.filter((person) => searchKey(person.name).includes(searchKey(search)));
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[pickerStyles.overlay, { backgroundColor: '#0008' }]}>
        <View accessibilityViewIsModal style={[pickerStyles.panel, { backgroundColor: colors.surface }]}>
          <ThemedText style={eventFieldStyles.title}>{title}</ThemedText>
          <ThemedText style={eventFieldStyles.message}>{t('events.selectedPeople', { count: value.length, max })}</ThemedText>
          <EventText label={t('events.searchPeople')} value={search} onChangeText={setSearch} />
          {source.status === 'error' && <EventButton label={t('events.retryPeople')} onPress={source.load} />}
          {source.status === 'loading' && <ThemedText>{t('events.loading')}</ThemedText>}
          <ScrollView style={pickerStyles.list} keyboardShouldPersistTaps="handled">
            <View style={eventFieldStyles.group}>
              {value.filter((id) => source.status === 'ready' && !source.people.some((person) => person.uid === id)).map((id) => (
                <EventButton key={id} label={t('events.removeUnavailable')} selected onPress={() => onChange(value.filter((item) => item !== id))} />
              ))}
              {visiblePeople.map((person) => {
                const selected = value.includes(person.uid);
                return <EventButton key={person.uid} label={person.name} selected={selected}
                  disabled={!selected && max > 1 && value.length >= max}
                  onPress={() => onChange(selected ? value.filter((id) => id !== person.uid) : max === 1 ? [person.uid] : [...value, person.uid])} />;
              })}
              {source.status === 'ready' && visiblePeople.length === 0 && <ThemedText>{t('events.noPeople')}</ThemedText>}
            </View>
          </ScrollView>
          <EventButton label={t('events.done')} onPress={onClose} primary />
        </View>
      </View>
    </Modal>
  );
}

export function ScheduleEditor({ schedule, start, end, source, onChange, onRemove }: {
  schedule: EventSchedule; start: string; end?: string; source: ReturnType<typeof useEventPeople>;
  onChange: (next: EventSchedule) => void; onRemove: () => void;
}) {
  const { t } = useI18n();
  const [selectedShift, setSelectedShift] = useState<number | null>(null);
  const colors = useAppColors();
  const shifts = buildEventShifts(schedule);
  const people = new Map(source.people.map((person) => [person.uid, person.name]));
  const window = schedule.pendingHours ?? {
    startTime: schedule.startTime, endTime: schedule.endTime, minutes: String(schedule.minutesPerShift || ''),
  };
  const updateTime = (patch: Partial<typeof window>) => {
    // Preserve the applied times and teams until the editor explicitly regenerates the timetable.
    onChange({ ...schedule, pendingHours: { ...window, ...patch } });
  };
  const { pendingHours: _pending, ...applied } = schedule;
  const nextTimes = { startTime: window.startTime.trim(), endTime: window.endTime.trim(), minutesPerShift: Number(window.minutes) };
  const nextShifts = buildEventShifts(nextTimes);
  const confirmTeamRemoval = () => confirmAlert({
    title: t('events.changedHours'), message: t('events.changedHoursMessage'),
    confirmLabel: t('events.done'), cancelLabel: t('events.cancel'),
  });
  const applyTime = async () => {
    if (!nextShifts.length) return;
    const shiftKey = (shift: { start: string; end: string }) => `${shift.start}/${shift.end}`;
    const existing = new Map(shifts.map((shift, index) => [shiftKey(shift), schedule.teams[index]]));
    const nextKeys = new Set(nextShifts.map(shiftKey));
    const losesAssignments = [...existing].some(([key, team]) => !nextKeys.has(key) && team?.memberIds.length);
    if (losesAssignments && !(await confirmTeamRemoval())) return;
    onChange({
      ...applied, ...nextTimes,
      teams: nextShifts.map((shift) => existing.get(shiftKey(shift)) ?? { memberIds: [] }),
    });
  };
  const remove = async () => {
    if (schedule.teams.some((team) => team.memberIds.length) && !(await confirmTeamRemoval())) return;
    onRemove();
  };
  const teamAt = (index: number): EventTeam => schedule.teams[index] ?? { memberIds: [] };
  const updateTeam = (index: number, team: EventTeam) => onChange({
    ...schedule, teams: shifts.map((_, position) => position === index ? team : teamAt(position)),
  });
  const selectedTeam = selectedShift === null ? { memberIds: [] } : teamAt(selectedShift);
  return (
    <EventSection>
      <EventText label={t('events.scheduleName')} maxLength={100} value={schedule.name}
        onChangeText={(name) => onChange({ ...schedule, name })} />
      <EventDate label={t('events.scheduleDate')} value={schedule.date} minimum={start} maximum={end}
        onChange={(date) => onChange({ ...schedule, date })} />
      <View style={eventFieldStyles.row}>
        <EventText label={t('events.startTime')} value={window.startTime} onChangeText={(startTime) => updateTime({ startTime })} maxLength={5} placeholder="09:00" />
        <EventText label={t('events.endTime')} value={window.endTime} onChangeText={(endTime) => updateTime({ endTime })} maxLength={5} placeholder="16:00" />
        <EventText label={t('events.shiftMinutes')} value={window.minutes} onChangeText={(minutes) => updateTime({ minutes })} keyboardType="number-pad" maxLength={3} />
      </View>
      <EventButton label={t('events.applyHours')} disabled={!nextShifts.length} onPress={applyTime} />
      {schedule.pendingHours && !nextShifts.length && <ThemedText>{t('events.invalidSchedule')}</ThemedText>}
      {shifts.length > 0 && <ThemedText>{t('events.appliedHours', { start: schedule.startTime, end: schedule.endTime, minutes: schedule.minutesPerShift })}</ThemedText>}
      {shifts.map((shift, index) => {
        const team = teamAt(index);
        const capacity = team.capacity ?? schedule.teamSize;
        const hours = `${shift.start} – ${shift.end}`;
        const changeCapacity = (next: number) => updateTeam(index, { ...team, capacity: next });
        return (
          <View key={shift.start} style={[eventFieldStyles.shift, { borderColor: colors.border }]}>
            <EventButton label={`${hours} · ${t('events.choosePeople')} · ${team.memberIds.length}/${capacity}`}
              onPress={() => { setSelectedShift(index); void source.load(); }} />
            {Array.from({ length: capacity }, (_, position) => {
              const uid = team.memberIds[position];
              const name = uid ? people.get(uid) ?? t('events.member') : t('events.availablePlace');
              return <ThemedText key={position}>{position + 1}. {name}</ThemedText>;
            })}
            <View style={eventFieldStyles.row}>
              <EventButton label={t('events.addPlace')} accessibilityLabel={t('events.addPlaceFor', { hours })}
                disabled={capacity >= EVENT_LIMITS.teamSize} onPress={() => changeCapacity(capacity + 1)} />
              {capacity > DEFAULT_EVENT_TEAM_SIZE && <EventButton label={t('events.removePlace')}
                accessibilityLabel={t('events.removePlaceFor', { hours })} disabled={team.memberIds.length >= capacity}
                onPress={() => changeCapacity(capacity - 1)} />}
            </View>
          </View>
        );
      })}
      <EventButton label={t('events.removeSchedule')} onPress={remove} />
      {selectedShift !== null && <PeoplePicker title={t('events.choosePeople')} value={selectedTeam.memberIds}
        max={selectedTeam.capacity ?? schedule.teamSize} source={source} onClose={() => setSelectedShift(null)}
        onChange={(memberIds) => updateTeam(selectedShift, { ...selectedTeam, memberIds })} />}
    </EventSection>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
  panel: { width: '100%', maxWidth: 480, maxHeight: '90%', borderRadius: 14, padding: 16, gap: 10 },
  list: { flexGrow: 0 },
});
