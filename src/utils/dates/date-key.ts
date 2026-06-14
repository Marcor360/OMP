const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateKey = (value: string): Date | null => {
  const match = value.trim().match(DATE_KEY_PATTERN);
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

export const getMonthIdFromDateKey = (dateKey: string): string => dateKey.slice(0, 7);

export const isDateKey = (value: unknown): value is string =>
  typeof value === 'string' && parseDateKey(value) !== null;

