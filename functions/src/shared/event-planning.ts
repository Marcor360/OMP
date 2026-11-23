export const EVENT_CATEGORIES = [
  'asamblea', 'limpieza', 'mantenimiento', 'acomodadores', 'comida', 'precursores', 'ancianos', 'otro',
] as const;
export type EventCategory = typeof EVENT_CATEGORIES[number];

export const EVENT_AUDIENCES = ['congregation', 'service', 'cleaning', 'family'] as const;
export type EventAudienceKind = typeof EVENT_AUDIENCES[number];
export type EventAudience = { kind: EventAudienceKind; groupId?: string };
export const EVENT_LIMITS = { schedules: 6, shifts: 48, teamSize: 6, people: 96 };
export const DEFAULT_EVENT_TEAM_SIZE = 2;
export const EVENT_TIME_ZONE = 'America/Mexico_City';

export type EventTeam = { memberIds: string[]; capacity?: number };

export type EventSchedule = {
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  minutesPerShift: number;
  teamSize: number;
  pendingHours?: { startTime: string; endTime: string; minutes: string };
  teams: EventTeam[];
};

export type EventPerson = { uid: string; name: string };
export type PublishedEventSchedule = EventSchedule & { people: EventPerson[] };

export const eventDay = (date: Date): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EVENT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
};

export const isEventDay = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const isEventId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 128
  && !value.includes('/') && value !== '.' && value !== '..' && !/^__.*__$/.test(value);

const toMinutes = (time: string): number => {
  if (time === '24:00') return 1440;
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};
const toTime = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export function buildEventShifts({ startTime, endTime, minutesPerShift }: Pick<EventSchedule, 'startTime' | 'endTime' | 'minutesPerShift'>) {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start
    || !Number.isInteger(minutesPerShift) || minutesPerShift < 15 || minutesPerShift > 720) return [];
  const count = Math.ceil((end - start) / minutesPerShift);
  if (count > EVENT_LIMITS.shifts) return [];
  return Array.from({ length: count }, (_, index) => {
    const from = start + index * minutesPerShift;
    return { start: toTime(from), end: toTime(Math.min(end, from + minutesPerShift)) };
  });
}

export function isEventTeamSize(size: unknown): size is number {
  return typeof size === 'number' && Number.isInteger(size)
    && size >= DEFAULT_EVENT_TEAM_SIZE && size <= EVENT_LIMITS.teamSize;
}

export type EventPlanningError = 'unappliedHours' | 'invalidSchedule' | 'scheduleDate' | 'incompleteShift' | 'overlappingShifts' | 'tooManyPeople';
export function validateEventSchedules(schedules: EventSchedule[], start: string, end: string): EventPlanningError | null {
  if (schedules.length > EVENT_LIMITS.schedules) return 'invalidSchedule';
  const byPerson = new Map<string, { date: string; start: string; end: string }[]>();
  for (const schedule of schedules) {
    if (schedule.pendingHours) return 'unappliedHours';
    if (!schedule.name.trim() || schedule.name.trim().length > 100
      || !isEventTeamSize(schedule.teamSize)) return 'invalidSchedule';
    if (!isEventDay(schedule.date) || schedule.date < start || schedule.date > end) return 'scheduleDate';
    const shifts = buildEventShifts(schedule);
    if (!shifts.length) return 'invalidSchedule';
    if (shifts.length !== schedule.teams.length) return 'incompleteShift';
    for (const [index, { memberIds: team, capacity = schedule.teamSize }] of schedule.teams.entries()) {
      if (!isEventTeamSize(capacity)) return 'invalidSchedule';
      if (team.length !== capacity || new Set(team).size !== team.length || !team.every(isEventId)) return 'incompleteShift';
      const shift = { ...shifts[index], date: schedule.date };
      for (const uid of team) {
        const assigned = byPerson.get(uid) ?? [];
        if (assigned.some((other) => other.date === shift.date && other.start < shift.end && shift.start < other.end)) return 'overlappingShifts';
        assigned.push(shift);
        byPerson.set(uid, assigned);
      }
    }
  }
  return byPerson.size > EVENT_LIMITS.people ? 'tooManyPeople' : null;
}
