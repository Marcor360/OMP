jest.mock('firebase/firestore', () => ({ Timestamp: {} }));

import {
  getDatePart,
  getTimePart,
  parseInputDateTime,
  replaceDatePart,
  replaceTimePart,
  toInputDateTime,
} from '@/src/screens/meetings/meeting-form/midweek-meeting-form.utils';

describe('midweek meeting form date helpers', () => {
  it('round-trips a valid local date input', () => {
    const parsed = parseInputDateTime('2026-09-25 19:30');
    expect(parsed).not.toBeNull();
    expect(toInputDateTime({ toDate: () => parsed as Date })).toBe('2026-09-25 19:30');
  });

  it.each(['2026-02-30 19:30', '2026-09-25 25:30', '25/09/2026 19:30', ''])('rejects %s', (value) => {
    expect(parseInputDateTime(value)).toBeNull();
  });

  it('changes date and time independently', () => {
    expect(getDatePart('2026-09-25 19:30')).toBe('2026-09-25');
    expect(getTimePart('2026-09-25 19:30')).toBe('19:30');
    expect(replaceDatePart('2026-09-25 19:30', '2026-10-02', '21:00')).toBe('2026-10-02 19:30');
    expect(replaceTimePart('2026-09-25 19:30', '20:00')).toBe('2026-09-25 20:00');
  });
});
