import {
  filterEligibleUsers,
  isHospitalityRoleIncompatible,
} from '@/src/modules/assignments/utils/hospitality-eligibility';

const users = [
  { uid: 'chair', isElder: true, isMinisterialServant: false },
  { uid: 'door', isElder: false, isMinisterialServant: true },
  { uid: 'free', isElder: true, isMinisterialServant: false },
] as never[];

describe('hospitality meeting eligibility', () => {
  it('treats the chairman as incompatible with operational roles', () => {
    expect(isHospitalityRoleIncompatible('microphoneOne', 'chairman')).toBe(true);
    expect(filterEligibleUsers(users, 'microphoneOne', { chairman: 'chair' }).map((user) => user.uid))
      .toEqual(['door', 'free']);
  });

  it('uses attendantDoor as the real door-attendant role in both directions', () => {
    expect(isHospitalityRoleIncompatible('attendantDoor', 'microphoneOne')).toBe(true);
    expect(filterEligibleUsers(users, 'microphoneOne', { attendantDoor: 'door' }).map((user) => user.uid))
      .toEqual(['chair', 'free']);
    expect(filterEligibleUsers(users, 'attendantDoor', { microphoneOne: 'door' }).map((user) => user.uid))
      .toEqual(['chair', 'free']);
  });

  it('keeps the restriction scoped to the current meeting assignments', () => {
    expect(filterEligibleUsers(users, 'audioVideo', {}).map((user) => user.uid)).toContain('door');
  });
});
