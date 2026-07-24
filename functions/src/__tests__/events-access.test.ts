import { canManageEvents } from '../shared/events-access.js';
import type { EventsAccessDeps, EventsAvisosAction } from '../shared/events-access.js';

const deps = (
  avisos: Partial<Record<EventsAvisosAction, boolean>>
): EventsAccessDeps => ({
  hasAvisosPermission: (action) => avisos[action] === true || avisos.manage === true,
});

const NO_AVISOS = deps({});

describe('events access', () => {
  it('allows an admin without avisos permissions', () => {
    expect(canManageEvents({ role: 'admin' }, NO_AVISOS)).toBe(true);
  });

  // Regresion: antes del PR 4b assertEventManager gateaba solo por rol y este
  // perfil podia crear, editar y BORRAR eventos de toda la congregacion.
  it('denies a supervisor without avisos permissions', () => {
    expect(canManageEvents({ role: 'supervisor' }, NO_AVISOS)).toBe(false);
  });

  it('allows a supervisor with avisos.manage', () => {
    expect(canManageEvents({ role: 'supervisor' }, deps({ manage: true }))).toBe(true);
  });

  it('allows a user with avisos.manage', () => {
    expect(canManageEvents({ role: 'user' }, deps({ manage: true }))).toBe(true);
  });

  it('denies a user with avisos.create but without edit', () => {
    expect(canManageEvents({ role: 'user' }, deps({ create: true }))).toBe(false);
  });

  it('denies a user with avisos.edit but without create', () => {
    expect(canManageEvents({ role: 'user' }, deps({ edit: true }))).toBe(false);
  });

  it('allows a user with avisos.create and avisos.edit', () => {
    expect(canManageEvents({ role: 'user' }, deps({ create: true, edit: true }))).toBe(true);
  });

  it('denies a user without avisos permissions', () => {
    expect(canManageEvents({ role: 'user' }, NO_AVISOS)).toBe(false);
  });

  it('denies a null user', () => {
    expect(canManageEvents(null, NO_AVISOS)).toBe(false);
  });

  it('denies an undefined user', () => {
    expect(canManageEvents(undefined, NO_AVISOS)).toBe(false);
  });
});
