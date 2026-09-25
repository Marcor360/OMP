jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(),
}));

import { filterPersonCandidates } from '@/src/modules/assignments/components/UserPickerModal';
import { filterEligibleUsers } from '@/src/modules/assignments/utils/hospitality-eligibility';

const users = [
  { uid: 'jose', displayName: 'José Martínez', email: 'jose@example.test', isElder: true, isMinisterialServant: false },
  { uid: 'ana', displayName: 'Ana López', email: 'ana@example.test', isElder: false, isMinisterialServant: true },
  { uid: 'blocked', displayName: 'Carlos Bloqueado', email: 'blocked@example.test', isElder: false, isMinisterialServant: false },
] as never[];

describe('UserPickerModal person search', () => {
  it.each(['jos', 'MARTINEZ', '  sé mar  '])('finds name, surname, partial and accent-insensitive matches: %s', (query) => {
    expect(filterPersonCandidates(users, query).map((user) => user.uid)).toEqual(['jose']);
  });

  it('searches only candidates already eligible for the current assignment', () => {
    const eligible = filterEligibleUsers(users, 'microphoneOne', { attendantDoor: 'ana' });
    expect(filterPersonCandidates(eligible, 'jos').map((user) => user.uid)).toEqual(['jose']);
    expect(filterPersonCandidates(eligible, 'bloqueado')).toEqual([]);
  });

  it('immediately reflects a changed assignment eligibility set', () => {
    const before = filterEligibleUsers(users, 'audioVideo', {});
    const after = filterEligibleUsers(users, 'audioVideo', { microphoneOne: 'jose' });
    expect(filterPersonCandidates(before, 'jose').map((user) => user.uid)).toEqual(['jose']);
    expect(filterPersonCandidates(after, 'jose')).toEqual([]);
  });
});
