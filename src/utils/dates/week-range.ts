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

export const formatDateKey = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateKey = (value: string): Date | null => {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, yearRaw, monthRaw, dayRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const parsed = new Date(year, month - 1, day);
  parsed.setHours(0, 0, 0, 0);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};

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
