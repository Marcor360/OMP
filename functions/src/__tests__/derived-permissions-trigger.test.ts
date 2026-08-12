/**
 * Fase 0 (F0.2) — decideDerivedPermissionsUpdate / changedRelevantField
 *
 * Prueba la logica PURA de decision del trigger reconcileDerivedPermissionsOnUserWrite
 * sin invocar Firestore (igual que el resto de functions/src/__tests__, ningun
 * trigger real se mockea con un CloudEvent).
 */
import {
  changedRelevantField,
  decideDerivedPermissionsUpdate,
} from '../users/derived-permissions-trigger.js';

describe('changedRelevantField', () => {
  it('true en creacion (sin before)', () => {
    expect(changedRelevantField(undefined, { servicePosition: 'encargado' })).toBe(true);
  });

  it('true cuando cambia servicePosition', () => {
    expect(
      changedRelevantField(
        { servicePosition: 'auxiliar' },
        { servicePosition: 'encargado' }
      )
    ).toBe(true);
  });

  it('true cuando cambia serviceAssignments', () => {
    expect(
      changedRelevantField(
        { serviceAssignments: [] },
        { serviceAssignments: [{ position: 'encargado', department: 'limpieza' }] }
      )
    ).toBe(true);
  });

  it('false cuando solo cambia displayName (campo no relevante)', () => {
    expect(
      changedRelevantField(
        { servicePosition: 'encargado', serviceDepartment: 'limpieza', displayName: 'Antes' },
        { servicePosition: 'encargado', serviceDepartment: 'limpieza', displayName: 'Despues' }
      )
    ).toBe(false);
  });

  it('false cuando solo cambia derivedPermissions (la propia escritura del trigger)', () => {
    expect(
      changedRelevantField(
        { servicePosition: 'encargado', serviceDepartment: 'limpieza', derivedPermissions: {} },
        {
          servicePosition: 'encargado',
          serviceDepartment: 'limpieza',
          derivedPermissions: { limpieza: { view: true, manage: true } },
        }
      )
    ).toBe(false);
  });
});

describe('decideDerivedPermissionsUpdate', () => {
  it('cambio de servicePosition -> recalcula y pide escribir', () => {
    const decision = decideDerivedPermissionsUpdate(
      { servicePosition: 'auxiliar', serviceDepartment: 'limpieza' },
      { servicePosition: 'encargado', serviceDepartment: 'limpieza' }
    );

    expect(decision.shouldWrite).toBe(true);
    if (decision.shouldWrite) {
      expect(decision.derivedPermissions).toEqual({
        limpieza: { view: true, create: true, edit: true, delete: true, manage: true },
      });
    }
  });

  it('cambio de displayName -> NO escribe (salida temprana)', () => {
    const decision = decideDerivedPermissionsUpdate(
      { servicePosition: 'encargado', serviceDepartment: 'limpieza', displayName: 'Antes' },
      { servicePosition: 'encargado', serviceDepartment: 'limpieza', displayName: 'Despues' }
    );

    expect(decision.shouldWrite).toBe(false);
  });

  it('documento borrado (sin after) -> no escribe', () => {
    expect(decideDerivedPermissionsUpdate({ servicePosition: 'encargado' }, undefined).shouldWrite).toBe(false);
  });

  it('la propia escritura del trigger no dispara una segunda escritura (anti-bucle)', () => {
    // Simula la SEGUNDA invocacion, causada por la escritura que hizo el
    // trigger en la primera: solo cambio derivedPermissions.
    const afterFirstWrite = {
      servicePosition: 'encargado',
      serviceDepartment: 'limpieza',
      derivedPermissions: { limpieza: { view: true, create: true, edit: true, delete: true, manage: true } },
    };
    const beforeFirstWrite = {
      servicePosition: 'encargado',
      serviceDepartment: 'limpieza',
      // derivedPermissions ausente/desactualizado antes de la primera escritura.
    };

    const secondInvocationDecision = decideDerivedPermissionsUpdate(beforeFirstWrite, afterFirstWrite);
    expect(secondInvocationDecision.shouldWrite).toBe(false);
  });

  it('no escribe si el derivedPermissions ya almacenado coincide con el recalculado', () => {
    const decision = decideDerivedPermissionsUpdate(
      { servicePosition: 'auxiliar', serviceDepartment: 'reuniones' },
      {
        servicePosition: 'auxiliar',
        serviceDepartment: 'reuniones',
        serviceAssignments: [], // cambia sintacticamente (agrega el campo) pero no el resultado
        derivedPermissions: { reuniones: { view: true, edit: true } },
      }
    );

    expect(decision.shouldWrite).toBe(false);
  });

  it('permissions otorgados a mano nunca aparecen en la decision (solo se toca derivedPermissions)', () => {
    const decision = decideDerivedPermissionsUpdate(
      { servicePosition: 'auxiliar', serviceDepartment: 'limpieza' },
      {
        servicePosition: 'encargado',
        serviceDepartment: 'limpieza',
        permissions: { tesoreria: { manage: true } },
      }
    );

    expect(decision.shouldWrite).toBe(true);
    expect(Object.keys(decision)).not.toContain('permissions');
    if (decision.shouldWrite) {
      expect(decision.derivedPermissions.tesoreria).toBeUndefined();
    }
  });

  it('usuario sin cargo -> no escribe (evita poblar derivedPermissions vacio en cada doc)', () => {
    const decision = decideDerivedPermissionsUpdate(undefined, { role: 'user', isActive: true });
    expect(decision.shouldWrite).toBe(false);
  });
});
