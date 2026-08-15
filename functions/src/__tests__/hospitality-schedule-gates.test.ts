/**
 * Pruebas unitarias — Frontera de permisos Editor/Manager de hospitalidad (R2.C)
 *
 * Espejo funcional de los tests de rules en
 * firestore-rules/hospitality-schedules.rules.test.ts: el auxiliar debe pasar
 * assertHospitalityEditor pero NUNCA assertHospitalityManager (esa es la
 * correccion de esta ronda -- antes assertHospitalityManager tenia una rama
 * explicita para auxiliar que le daba permiso de publicar).
 */

import { HttpsError } from 'firebase-functions/v2/https';

import {
  assertHospitalityEditor,
  assertHospitalityManager,
  RequesterProfile,
} from '../planning-schedules.js';

const CONGREGATION_ID = 'c1';

const baseRequester = (overrides: Partial<RequesterProfile> = {}): RequesterProfile => ({
  role: 'user',
  isActive: true,
  congregationId: CONGREGATION_ID,
  servicePosition: undefined,
  serviceDepartment: undefined,
  serviceAssignments: [],
  permissions: undefined,
  ...overrides,
});

const admin = baseRequester({ role: 'admin' });
const encargado = baseRequester({
  serviceAssignments: [{ position: 'encargado', department: 'acomodadores_microfonos' }],
});
const auxiliar = baseRequester({
  serviceAssignments: [{ position: 'auxiliar', department: 'acomodadores_microfonos' }],
});
const auxiliarOtroDepartamento = baseRequester({
  serviceAssignments: [{ position: 'auxiliar', department: 'limpieza' }],
});
const plainMember = baseRequester();
const managePermissionUser = baseRequester({
  permissions: { acomodadores_microfonos: { manage: true } },
});
const editPermissionUser = baseRequester({
  permissions: { acomodadores_microfonos: { edit: true } },
});
const outsiderEncargado = baseRequester({
  congregationId: 'c2',
  serviceAssignments: [{ position: 'encargado', department: 'acomodadores_microfonos' }],
});

describe('assertHospitalityEditor', () => {
  it.each([
    ['admin', admin],
    ['encargado', encargado],
    ['auxiliar del departamento', auxiliar],
    ['usuario con permiso manage explicito', managePermissionUser],
    ['usuario con permiso edit explicito', editPermissionUser],
  ])('permite a %s', (_label, requester) => {
    expect(() => assertHospitalityEditor(requester, CONGREGATION_ID)).not.toThrow();
  });

  it.each([
    ['miembro sin cargo', plainMember],
    ['auxiliar de otro departamento', auxiliarOtroDepartamento],
  ])('bloquea a %s', (_label, requester) => {
    expect(() => assertHospitalityEditor(requester, CONGREGATION_ID)).toThrow(HttpsError);
  });

  it('bloquea a un encargado de otra congregacion', () => {
    expect(() => assertHospitalityEditor(outsiderEncargado, CONGREGATION_ID)).toThrow(HttpsError);
  });
});

describe('assertHospitalityManager', () => {
  it.each([
    ['admin', admin],
    ['encargado', encargado],
    ['usuario con permiso manage explicito', managePermissionUser],
  ])('permite a %s', (_label, requester) => {
    expect(() => assertHospitalityManager(requester, CONGREGATION_ID)).not.toThrow();
  });

  it('NUNCA permite publicar al auxiliar (correccion de esta ronda)', () => {
    expect(() => assertHospitalityManager(auxiliar, CONGREGATION_ID)).toThrow(HttpsError);
  });

  it('bloquea a un usuario con solo permiso edit (no es Manager)', () => {
    expect(() => assertHospitalityManager(editPermissionUser, CONGREGATION_ID)).toThrow(HttpsError);
  });

  it('bloquea a un miembro sin cargo', () => {
    expect(() => assertHospitalityManager(plainMember, CONGREGATION_ID)).toThrow(HttpsError);
  });

  it('bloquea a un encargado de otra congregacion', () => {
    expect(() => assertHospitalityManager(outsiderEncargado, CONGREGATION_ID)).toThrow(HttpsError);
  });
});

describe('Editor es superconjunto de Manager', () => {
  it('todo el que pasa Manager tambien pasa Editor', () => {
    for (const requester of [admin, encargado, managePermissionUser]) {
      expect(() => assertHospitalityManager(requester, CONGREGATION_ID)).not.toThrow();
      expect(() => assertHospitalityEditor(requester, CONGREGATION_ID)).not.toThrow();
    }
  });

  it('el auxiliar pasa Editor pero no Manager (la frontera del contrato §0.2)', () => {
    expect(() => assertHospitalityEditor(auxiliar, CONGREGATION_ID)).not.toThrow();
    expect(() => assertHospitalityManager(auxiliar, CONGREGATION_ID)).toThrow(HttpsError);
  });
});
