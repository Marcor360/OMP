import { isSystemPrincipalUser } from '../user-protection.js';

describe('isSystemPrincipalUser', () => {
  it('protege usuarios marcados explicitamente', () => {
    expect(isSystemPrincipalUser({ protectedFromDeletion: true })).toBe(true);
    expect(isSystemPrincipalUser({ isPrimaryAdmin: true })).toBe(true);
    expect(isSystemPrincipalUser({ isRootAdmin: true })).toBe(true);
  });

  it('no protege por identidad textual', () => {
    expect(isSystemPrincipalUser({ email: 'tu_correo@gmail.com' })).toBe(false);
    expect(isSystemPrincipalUser({ displayName: 'Sistema Sistema' })).toBe(false);
  });

  it('no protege usuarios normales aunque los haya creado el sistema principal', () => {
    expect(
      isSystemPrincipalUser({
        role: 'admin',
        email: 'usuario@congregacion.com',
        displayName: 'Usuario Normal',
        createdBy: 'system',
        createdByName: 'Sistema Sistema',
        createdByEmail: 'tu_correo@gmail.com',
      })
    ).toBe(false);
  });
});
