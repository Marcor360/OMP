import {
  DEFAULT_OPTIONAL_ROLES,
  buildItemsFromRows,
  buildRowsFromMeetings,
  selectInitialHospitalitySchedule,
} from '@/src/modules/assignments/hooks/useHospitalityScheduleBuilder';
import { canArchiveHospitalitySchedule } from '@/src/modules/assignments/components/HospitalityScheduleSetup';
import type { HospitalitySchedule, HospitalityScheduleItem } from '@/src/types/hospitality-microphones';
import type { Meeting } from '@/src/types/meeting';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock('@/src/context/user-context', () => ({ useUser: jest.fn() }));
jest.mock('@/src/i18n', () => ({ useI18n: jest.fn() }));
jest.mock('@/src/services/hospitality-microphones/hospitality-microphones-service', () => ({}));
jest.mock('@/src/services/meetings/meetings-service', () => ({}));
jest.mock('@/src/modules/assignments/services/outgoing-talks.service', () => ({}));
jest.mock('@/src/services/users/active-users-service', () => ({}));

const makeSchedule = (
  id: string,
  status: HospitalitySchedule['status'],
  createdAtMillis: number
): HospitalitySchedule => ({
  id,
  congregationId: 'cong-1',
  title: id,
  startDate: '2026-08-01',
  endDate: '2026-09-30',
  monthIds: ['2026-08', '2026-09'],
  totalMeetings: 1,
  status,
  createdBy: 'uid-1',
  updatedBy: 'uid-1',
  createdAt: { toMillis: () => createdAtMillis } as never,
  updatedAt: { toMillis: () => createdAtMillis } as never,
});

describe('hospitality schedule builder helpers', () => {
  it('prefers the published current schedule, otherwise the newest draft', () => {
    const olderDraft = makeSchedule('draft-old', 'draft', 1);
    const newerDraft = makeSchedule('draft-new', 'draft', 2);
    const published = makeSchedule('published', 'published', 1);

    expect(selectInitialHospitalitySchedule([olderDraft, newerDraft], '2026-08-11')?.id)
      .toBe('draft-new');
    expect(selectInitialHospitalitySchedule([newerDraft, published], '2026-08-11')?.id)
      .toBe('published');
  });

  it('keeps assignments separate for two meetings of the same type and date', () => {
    const meetings = [
      { id: 'meeting-1', title: 'First', type: 'weekend', meetingCategory: 'weekend', meetingDate: '2026-08-15' },
      { id: 'meeting-2', title: 'Second', type: 'weekend', meetingCategory: 'weekend', meetingDate: '2026-08-15' },
    ] as unknown as Meeting[];
    const items = [
      { meetingId: 'meeting-1', meetingDate: '2026-08-15', meetingType: 'weekend', roleKey: 'microphoneOne', userId: 'user-1', status: 'scheduled' },
      { meetingId: 'meeting-2', meetingDate: '2026-08-15', meetingType: 'weekend', roleKey: 'microphoneOne', userId: 'user-2', status: 'scheduled' },
    ] as HospitalityScheduleItem[];

    const rows = buildRowsFromMeetings(meetings, items, DEFAULT_OPTIONAL_ROLES);

    expect(rows[0].assignments.microphoneOne).toBe('user-1');
    expect(rows[1].assignments.microphoneOne).toBe('user-2');
  });

  it('includes meeting ids and leaves user validation to the callable', () => {
    const items = buildItemsFromRows({
      rows: [{
        meetingId: 'meeting-1',
        meetingTitle: 'Meeting',
        meetingDate: '2026-08-12',
        meetingType: 'midweek',
        assignments: { microphoneOne: 'inactive-user' },
      }],
      optionalRoles: DEFAULT_OPTIONAL_ROLES,
    });

    expect(items).toEqual([{
      meetingId: 'meeting-1',
      meetingDate: '2026-08-12',
      meetingType: 'midweek',
      roleKey: 'microphoneOne',
      userId: 'inactive-user',
    }]);
  });

  it('lets editors archive drafts but reserves published schedules for managers', () => {
    expect(canArchiveHospitalitySchedule('draft', true, false)).toBe(true);
    expect(canArchiveHospitalitySchedule('published', true, false)).toBe(false);
    expect(canArchiveHospitalitySchedule('published', true, true)).toBe(true);
    expect(canArchiveHospitalitySchedule('archived', true, true)).toBe(false);
  });
});
