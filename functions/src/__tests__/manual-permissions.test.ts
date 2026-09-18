import { decideManualPermissionsUpdate } from '../users/manual-permissions.js';

const passthrough = <T>(value: T): T => value;

describe('manual permissions role semantics', () => {
  it.each(['user', 'admin'] as const)('removes supervisor permissions when role changes to %s', (nextRole) => {
    expect(decideManualPermissionsUpdate({
      nextRole, permissionsProvided: false, sanitize: passthrough,
    })).toEqual({ action: 'remove' });
  });

  it('preserves existing supervisor permissions when the field is absent', () => {
    expect(decideManualPermissionsUpdate({
      nextRole: 'supervisor', permissionsProvided: false, sanitize: passthrough,
    })).toEqual({ action: 'preserve' });
  });

  it('removes permissions for an explicitly empty supervisor payload', () => {
    expect(decideManualPermissionsUpdate({
      nextRole: 'supervisor', permissionsProvided: true, permissions: {}, sanitize: passthrough,
    })).toEqual({ action: 'remove' });
  });

  it('sets an explicit supervisor permissions payload without touching derived permissions', () => {
    const permissions = { limpieza: { edit: true } };
    expect(decideManualPermissionsUpdate({
      nextRole: 'supervisor', permissionsProvided: true, permissions, sanitize: passthrough,
    })).toEqual({ action: 'set', permissions });
  });
});
