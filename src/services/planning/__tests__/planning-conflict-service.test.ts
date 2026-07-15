import {
  type HospitalityPlanningItem,
  validateHospitalityScheduleBeforePublish,
  validateMeetingBeforeSaveWithPlanning,
  validateNoDuplicateUsersPerMeeting,
} from '@/src/services/planning/planning-conflict-service';

const window = {
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  monthIds: ['2026-08'],
  totalDays: 31,
};

const user = {
  uid: 'speaker-1',
  displayName: 'Juan Perez',
  congregationId: 'cong-1',
  isActive: true,
};

const outgoingTalk = {
  id: 'talk-1',
  speakerUserId: user.uid,
  speakerName: user.displayName,
  talkDate: '2026-08-08',
  weekStartDate: '2026-08-03',
  status: 'scheduled' as const,
};

const validateItem = (
  meetingType: 'midweek' | 'weekend',
  status: 'scheduled' | 'cancelled' = 'scheduled'
) => validateHospitalityScheduleBeforePublish({
  congregationId: 'cong-1',
  window,
  existingSchedules: [],
  items: [{
    meetingDate: meetingType === 'weekend' ? '2026-08-09' : '2026-08-05',
    meetingType,
    roleKey: 'microphoneOne',
    roleLabel: 'Microfono 1',
    userId: user.uid,
  }],
  users: [user],
  outgoingTalks: [{ ...outgoingTalk, status }],
});

describe('planning outgoing-talk conflicts', () => {
  it('blocks a weekend hospitality assignment in the outgoing-talk week', () => {
    const result = validateItem('weekend');

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain(user.displayName);
    expect(result.errors.join(' ')).toContain(outgoingTalk.talkDate);
  });

  it('allows a midweek hospitality assignment in the same week', () => {
    expect(validateItem('midweek').ok).toBe(true);
  });

  it('ignores cancelled outgoing talks', () => {
    expect(validateItem('weekend', 'cancelled').ok).toBe(true);
  });

  it('uses the user name in meeting conflict messages', () => {
    const result = validateMeetingBeforeSaveWithPlanning({
      assignedUserIds: [user.uid],
      scheduledOutgoingTalkSpeakerIds: [user.uid],
      userNamesById: new Map([[user.uid, user.displayName]]),
    });

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain(user.displayName);
    expect(result.errors[0]).not.toContain(user.uid);
  });
});

describe('validateNoDuplicateUsersPerMeeting', () => {
  const makeItem = (overrides: Partial<HospitalityPlanningItem>): HospitalityPlanningItem => ({
    meetingDate: '2026-07-19',
    meetingType: 'weekend',
    roleKey: 'microphoneOne',
    roleLabel: 'Microfono 1',
    userId: 'user-1',
    ...overrides,
  });

  it('rejects the same user assigned as chairman and microphoneOne in the same meeting', () => {
    const items: HospitalityPlanningItem[] = [
      makeItem({ roleKey: 'chairman', roleLabel: 'Presidente', userId: 'user-1' }),
      makeItem({ roleKey: 'microphoneOne', roleLabel: 'Microfono 1', userId: 'user-1' }),
    ];

    const result = validateNoDuplicateUsersPerMeeting(items);

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('user-1');
  });

  it('allows the same user to chair different meetings without conflict', () => {
    const items: HospitalityPlanningItem[] = [
      makeItem({ roleKey: 'chairman', roleLabel: 'Presidente', userId: 'user-1', meetingDate: '2026-07-19' }),
      makeItem({ roleKey: 'chairman', roleLabel: 'Presidente', userId: 'user-1', meetingDate: '2026-07-22', meetingType: 'midweek' }),
    ];

    const result = validateNoDuplicateUsersPerMeeting(items);

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('allows different users holding different roles in the same meeting', () => {
    const items: HospitalityPlanningItem[] = [
      makeItem({ roleKey: 'chairman', roleLabel: 'Presidente', userId: 'user-1' }),
      makeItem({ roleKey: 'microphoneOne', roleLabel: 'Microfono 1', userId: 'user-2' }),
    ];

    const result = validateNoDuplicateUsersPerMeeting(items);

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
