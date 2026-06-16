import {
  formatDateKey,
  getMonthIdFromDateKey,
  isDateKey,
  parseDateKey,
} from '@/src/utils/dates/date-key';
import {
  getWeekEnd,
  getWeekRangeForDate,
  getWeekStart,
} from '@/src/utils/dates/week-range';

describe('date key utilities', () => {
  it('formats and parses stable YYYY-MM-DD keys', () => {
    const date = new Date(2026, 8, 1, 15, 30);

    expect(formatDateKey(date)).toBe('2026-09-01');
    expect(parseDateKey('2026-09-01')?.getFullYear()).toBe(2026);
    expect(getMonthIdFromDateKey('2026-09-01')).toBe('2026-09');
  });

  it('rejects impossible or malformed date keys', () => {
    expect(isDateKey('2026-02-29')).toBe(false);
    expect(isDateKey('2026-13-01')).toBe(false);
    expect(isDateKey('09/01/2026')).toBe(false);
  });

  it('builds Monday-to-Sunday week ranges', () => {
    const start = getWeekStart(new Date(2026, 5, 17));
    const end = getWeekEnd(start);

    expect(formatDateKey(start)).toBe('2026-06-15');
    expect(formatDateKey(end)).toBe('2026-06-21');
    expect(getWeekRangeForDate('2026-06-17').weekStartDate).toBe('2026-06-15');
  });
});
