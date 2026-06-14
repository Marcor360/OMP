import {
  formatDateKey,
  parseDateKey,
} from '@/src/utils/dates/date-key';

export {
  formatDateKey,
  parseDateKey,
  getMonthIdFromDateKey,
  isDateKey,
} from '@/src/utils/dates/date-key';

export const getWeekStart = (baseDate: Date): Date => {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);

  const day = start.getDay();
  const shift = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + shift);

  return start;
};

export const getWeekEnd = (weekStart: Date): Date => {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
};

export const moveWeek = (baseStart: Date, offset: number): Date => {
  const next = new Date(baseStart);
  next.setDate(next.getDate() + offset * 7);
  return next;
};

export const formatWeekLabel = (weekStart: Date, weekEnd: Date): string =>
  `${weekStart.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} - ${weekEnd.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}`;

export const getWeekRangeForDate = (
  value: Date | string
): { weekStartDate: string; weekEndDate: string; startDate: Date; endDate: Date } => {
  const parsed = typeof value === 'string' ? parseDateKey(value) : value;
  const base = parsed instanceof Date ? parsed : new Date();
  const startDate = getWeekStart(base);
  const endDate = getWeekEnd(startDate);

  return {
    weekStartDate: formatDateKey(startDate),
    weekEndDate: formatDateKey(endDate),
    startDate,
    endDate,
  };
};
