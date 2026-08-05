import { Timestamp } from 'firebase-admin/firestore';

import { hasMaterialChange } from '../events.js';

describe('event notification material changes', () => {
  it('ignores audit-only updates', () => {
    const date = Timestamp.fromDate(new Date('2026-08-10T06:00:00.000Z'));

    expect(hasMaterialChange(
      { title: 'Evento', startDate: date, updatedBy: 'user-1' },
      { title: 'Evento', startDate: date, updatedBy: 'user-2' }
    )).toBe(false);
  });

  it('detects a changed timestamp value', () => {
    expect(hasMaterialChange(
      { startDate: Timestamp.fromDate(new Date('2026-08-10T06:00:00.000Z')) },
      { startDate: Timestamp.fromDate(new Date('2026-08-11T06:00:00.000Z')) }
    )).toBe(true);
  });

  it('treats a missing previous event as material', () => {
    expect(hasMaterialChange(null, { title: 'Evento' })).toBe(true);
  });
});
