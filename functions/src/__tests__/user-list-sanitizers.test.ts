import {
  getVisibleListedUsers,
  isSystemPrincipalListRecord,
} from '../users/list-sanitizers.js';

describe('user list visibility', () => {
  it('excludes protected system principals', () => {
    expect(isSystemPrincipalListRecord({ isSystemUser: true })).toBe(true);
    expect(isSystemPrincipalListRecord({ displayName: 'Sistema Sistema' })).toBe(false);

    expect(
      getVisibleListedUsers([
        { uid: 'system', email: 'system@example.com', protectedFromDeletion: true },
        { uid: 'person', email: 'person@example.com', displayName: 'Persona' },
      ])
    ).toHaveLength(1);
  });

  it('deduplicates email case-insensitively and prefers the active record', () => {
    const users = getVisibleListedUsers([
      { uid: 'old', email: 'Person@Example.com', displayName: 'Anterior', isActive: false },
      { uid: 'current', email: 'person@example.com', displayName: 'Actual', isActive: true },
    ]);

    expect(users).toHaveLength(1);
    expect(users[0].uid).toBe('current');
  });

  it('sorts the resulting visible users by display label', () => {
    const users = getVisibleListedUsers([
      { uid: 'z', email: 'z@example.com', displayName: 'Zeta' },
      { uid: 'a', email: 'a@example.com', displayName: 'Ana' },
    ]);

    expect(users.map((user) => user.uid)).toEqual(['a', 'z']);
  });
});
