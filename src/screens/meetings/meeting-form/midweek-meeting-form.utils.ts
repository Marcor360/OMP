import type { AssignmentCardEditorErrors } from '@/src/components/meetings/midweek/AssignmentCardEditor';
import type { MidweekMeeting } from '@/src/services/meetings/midweek-meetings-service';
import {
  type MidweekMeetingSection,
  createMidweekMeetingTemplate,
  normalizeSectionOrder,
} from '@/src/types/midweek-meeting';

export type MidweekMeetingFormState = {
  title: string;
  description: string;
  weekLabel: string;
  bibleReading: string;
  startDateInput: string;
  endDateInput: string;
  location: string;
  meetingUrl: string;
  notes: string;
  openingSong: string;
  openingPrayer: string;
  openingPrayerUserId: string;
  middleSong: string;
  closingSong: string;
  closingPrayer: string;
  closingPrayerUserId: string;
  chairmanUserId: string;
  chairmanName: string;
  sections: MidweekMeetingSection[];
};

export type MidweekMeetingFormErrors = {
  title?: string;
  weekLabel?: string;
  bibleReading?: string;
  startDateInput?: string;
  endDateInput?: string;
  sections?: string;
  chairmanUserId?: string;
  assignments: Record<string, AssignmentCardEditorErrors>;
};

export type DatePickerTarget = 'start' | 'end' | null;
type DateLikeTimestamp = { toDate(): Date };

const pad = (value: number): string => String(value).padStart(2, '0');

export const toInputDateTime = (value: DateLikeTimestamp): string => {
  const date = value.toDate();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const parseInputDateTime = (value: string): Date | null => {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw] = match;
  const [year, month, day, hour, minute] = [yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw].map(Number);
  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);

  return parsed.getFullYear() === year
    && parsed.getMonth() === month - 1
    && parsed.getDate() === day
    && parsed.getHours() === hour
    && parsed.getMinutes() === minute
    ? parsed
    : null;
};

export const getDatePart = (value: string): string => value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? '';
export const getTimePart = (value: string): string => value.match(/(\d{2}:\d{2})$/)?.[1] ?? '';
export const replaceDatePart = (value: string, date: string, fallbackTime: string): string =>
  `${date} ${getTimePart(value) || fallbackTime}`;
export const replaceTimePart = (value: string, time: string): string => `${getDatePart(value)} ${time}`;

export const initialMidweekMeetingFormState = (): MidweekMeetingFormState => {
  const template = createMidweekMeetingTemplate();
  return {
    title: template.title,
    description: template.description ?? '',
    weekLabel: template.weekLabel,
    bibleReading: template.bibleReading,
    startDateInput: toInputDateTime(template.startDate),
    endDateInput: toInputDateTime(template.endDate),
    location: template.location ?? '',
    meetingUrl: template.meetingUrl ?? '',
    notes: '',
    openingSong: template.openingSong ?? '',
    openingPrayer: template.openingPrayer ?? '',
    openingPrayerUserId: '',
    middleSong: '',
    closingSong: template.closingSong ?? '',
    closingPrayer: template.closingPrayer ?? '',
    closingPrayerUserId: '',
    chairmanUserId: '',
    chairmanName: '',
    sections: normalizeSectionOrder(template.sections),
  };
};

export const mapMidweekMeetingToFormState = (meeting: MidweekMeeting): MidweekMeetingFormState => ({
  title: meeting.title,
  description: meeting.description ?? '',
  weekLabel: meeting.weekLabel,
  bibleReading: meeting.bibleReading,
  startDateInput: toInputDateTime(meeting.startDate),
  endDateInput: toInputDateTime(meeting.endDate),
  location: meeting.location ?? '',
  meetingUrl: meeting.meetingUrl ?? '',
  notes: meeting.notes ?? '',
  openingSong: meeting.openingSong ?? '',
  openingPrayer: meeting.openingPrayer ?? '',
  openingPrayerUserId: '',
  middleSong: meeting.middleSong ?? '',
  closingSong: meeting.closingSong ?? '',
  closingPrayer: meeting.closingPrayer ?? '',
  closingPrayerUserId: '',
  chairmanUserId: meeting.chairmanUserId ?? '',
  chairmanName: meeting.chairman ?? '',
  sections: normalizeSectionOrder(meeting.midweekSections),
});
