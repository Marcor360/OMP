/**
 * Fase 0 (F0.6) — functions/src/shared/permissions.ts:hasPermission
 * Espejo de permissionFlag()/hasPermission() en
 * rules_src/04-department-permissions.rules.
 */
import { hasPermission } from '../shared/permissions.js';

describe('hasPermission (shared)', () => {
  it('lee permissions (otorgado a mano)', () => {
    expect(hasPermission({ permissions: { limpieza: { edit: true } } }, 'limpieza', 'edit')).toBe(true);
  });

  it('lee derivedPermissions (calculado del cargo) sin permissions', () => {
    expect(
      hasPermission({ derivedPermissions: { limpieza: { edit: true } } }, 'limpieza', 'edit')
    ).toBe(true);
  });

  it('manage en un mapa es superconjunto SOLO de ese mapa', () => {
    expect(
      hasPermission({ derivedPermissions: { limpieza: { manage: true } } }, 'limpieza', 'edit')
    ).toBe(true);
    expect(
      hasPermission({ permissions: { limpieza: { manage: true } } }, 'limpieza', 'view')
    ).toBe(true);
  });

  it('un manage en permissions NO se filtra a derivedPermissions ni viceversa', () => {
    // Este test documenta la semantica explicita: cada fuente se evalua por
    // separado dentro de permissionFlag(); la union solo ocurre a nivel de
    // "algun mapa concede la accion", no de "manage en cualquiera implica
    // manage en el otro".
    const requester = { permissions: { limpieza: { manage: true } }, derivedPermissions: {} };
    expect(hasPermission(requester, 'limpieza', 'edit')).toBe(true); // via permissions.manage
    expect(hasPermission({ derivedPermissions: {} }, 'limpieza', 'edit')).toBe(false);
  });

  it('sin ningun mapa -> false', () => {
    expect(hasPermission({}, 'limpieza', 'edit')).toBe(false);
  });

  it('un departamento sin la accion solicitada -> false', () => {
    expect(hasPermission({ permissions: { limpieza: { view: true } } }, 'limpieza', 'edit')).toBe(false);
  });
});
