import { isSystemPrincipalUser } from '../user-protection.js';

describe('isSystemPrincipalUser', () => {
  it('protege usuarios marcados explicitamente', () => {
    expect(isSystemPrincipalUser({ protectedFromDeletion: true })).toBe(true);
    expect(isSystemPrincipalUser({ isPrimaryAdmin: true })).toBe(true);
    expect(isSystemPrincipalUser({ isRootAdmin: true })).toBe(true);
  });

  it('protege usuarios creados por el sistema principal', () => {
    expect(isSystemPrincipalUser({ createdBy: 'system' })).toBe(true);
    expect(isSystemPrincipalUser({ createdByName: 'Sistema Sistema' })).toBe(true);
    expect(isSystemPrincipalUser({ createdByEmail: 'tu_correo@gmail.com' })).toBe(true);
  });

  it('no protege usuarios creados desde la app por otro administrador', () => {
    expect(
      isSystemPrincipalUser({
        role: 'admin',
        createdBy: 'admin_uid',
        createdByName: 'Administrador Local',
      })
    ).toBe(false);
  });
});
