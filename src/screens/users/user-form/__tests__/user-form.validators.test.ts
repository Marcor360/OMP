import {
  getPrivilegesError,
  hasUserFormErrors,
  validateUserForm,
} from '../user-form.validators';

describe('user-form.validators', () => {
  it('keeps create required-field validation behavior', () => {
    const errors = validateUserForm({
      mode: 'create',
      displayName: '',
      firstName: ' ',
      lastName: '',
      password: '123',
      newPassword: '',
      hasGender: false,
      privileges: {},
    });

    expect(errors).toEqual({
      firstName: 'El primer nombre es requerido',
      lastName: 'El apellido paterno es requerido',
      password: 'La contrasena debe tener al menos 6 caracteres',
      gender: 'El genero es requerido.',
      assignment: undefined,
      privileges: undefined,
    });
    expect(hasUserFormErrors(errors)).toBe(true);
  });

  it('keeps edit password and display name validation behavior', () => {
    expect(
      validateUserForm({
        mode: 'edit',
        displayName: '',
        firstName: '',
        lastName: '',
        password: '',
        newPassword: '123',
        hasGender: true,
        privileges: {},
      })
    ).toMatchObject({
      displayName: 'El nombre es requerido',
      newPassword: 'La nueva contrasena debe tener al menos 6 caracteres',
      gender: undefined,
    });
  });

  it('keeps mutually exclusive privilege validation behavior', () => {
    expect(
      getPrivilegesError({
        isRegularPioneer: true,
        isAuxiliaryPioneer: true,
      })
    ).toBe('Un usuario no puede ser Precursor Regular y Auxiliar al mismo tiempo.');

    expect(
      getPrivilegesError({
        isElder: true,
        isMinisterialServant: true,
      })
    ).toBe('Un usuario no puede ser Anciano y Siervo Ministerial al mismo tiempo.');
  });
});
