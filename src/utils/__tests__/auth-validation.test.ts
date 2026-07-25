import { isValidLoginEmail } from '@/src/utils/auth-validation';

describe('isValidLoginEmail', () => {
  it.each([
    'persona@example.com',
    'nombre.apellido+etiqueta@example.com',
    '  persona@example.com  ',
  ])('accepts a valid email: %s', (email) => {
    expect(isValidLoginEmail(email)).toBe(true);
  });

  it.each([
    '',
    '   ',
    'persona',
    'persona@example',
    '@example.com',
    'persona@.com',
    'texto persona@example.com',
    'persona@example.com texto',
    'persona @example.com',
  ])('rejects an invalid email without allowing a valid substring: %s', (email) => {
    expect(isValidLoginEmail(email)).toBe(false);
  });
});
