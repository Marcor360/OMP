/* eslint-disable import/first */
jest.mock('firebase/firestore', () => {
  class MockTimestamp {
    private readonly mockDate: Date;

    constructor(mockDate: Date) {
      this.mockDate = mockDate;
    }

    static fromDate(mockDate: Date) {
      return new MockTimestamp(mockDate);
    }

    toDate() {
      return this.mockDate;
    }
  }

  return { Timestamp: MockTimestamp };
});

jest.mock('@/src/modules/assignments/utils/meeting-readers', () => ({
  isHospitalityMicrophonesControlledReader: () => false,
}));

import { Timestamp } from 'firebase/firestore';

import {
  buildMeetingPayload,
  formatDateInput,
  inferMidweekMeetingDay,
  inferWeekendMeetingDay,
  normalizeText,
  normalizeUrl,
} from '../meeting-form.mapper';

describe('meeting-form.mapper', () => {
  it('keeps text and URL normalization behavior', () => {
    expect(normalizeText('  Reunion  ')).toBe('Reunion');
    expect(normalizeText('   ')).toBeUndefined();
    expect(normalizeUrl('https://example.com/reunion')).toBe('https://example.com/reunion');
    expect(normalizeUrl('ftp://example.com/reunion')).toBeUndefined();
    expect(normalizeUrl('nope')).toBeUndefined();
  });

  it('formats date inputs as YYYY-MM-DD', () => {
    expect(formatDateInput(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('infers selected meeting days from dates', () => {
    expect(inferWeekendMeetingDay(
      new Date(2026, 5, 21),
      { startDate: new Date(2026, 5, 20), endDate: new Date(2026, 5, 21) }
    )).toBe('sunday');

    expect(inferMidweekMeetingDay(
      new Date(2026, 5, 24),
      { startDate: new Date(2026, 5, 22) }
    )).toBe('wednesday');
  });

  it('builds the same draft payload shape used by the form', () => {
    const payload = buildMeetingPayload({
      mode: 'create',
      intent: 'draft',
      startDate: new Date(2026, 5, 20),
      endDate: new Date(2026, 5, 21),
      actorUid: 'user-1',
      resolvedMeetingDate: new Date(2026, 5, 21),
      title: '  ',
      description: 'Descripcion',
      meetingType: 'weekend',
      selectedWeekLabel: '20/06/2026 - 26/06/2026',
      location: 'Salon',
      meetingUrl: 'https://example.com',
      notes: '',
      effectiveSections: [],
      cleaningSelectionMode: 'selected',
      selectedCleaningGroups: [{ id: 'group-1', name: 'Grupo 1' }],
    });

    expect(payload).toMatchObject({
      title: 'Reunion del fin de semana',
      description: 'Descripcion',
      type: 'weekend',
      meetingCategory: 'weekend',
      weekLabel: undefined,
      publicationStatus: 'draft',
      location: 'Salon',
      meetingUrl: 'https://example.com',
      notes: undefined,
      cleaningAssignmentMode: 'selected',
      cleaningGroupIds: ['group-1'],
      cleaningGroupNames: ['Grupo 1'],
      attendees: ['user-1'],
      createdBy: 'user-1',
      updatedBy: 'user-1',
    });
    expect(payload.startDate).toBeInstanceOf(Timestamp);
    expect(payload.endDate).toBeInstanceOf(Timestamp);
    expect(payload.meetingDate).toBeInstanceOf(Timestamp);
  });
});
