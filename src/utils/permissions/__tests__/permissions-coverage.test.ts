/**
 * PR C — guarda de cobertura en CI: falla si USER_SERVICE_DEPARTMENTS crece
 * sin registrar la decision correspondiente en
 * SERVICE_DEPARTMENT_PERMISSION_DECISIONS, o si esa tabla de decisiones deja
 * de coincidir con lo que assignmentToPermissions() realmente hace.
 *
 * Cada caso acumula mensajes de fallo ACCIONABLES (departamento + que hacer) y
 * los afirma contra [] -- Jest no soporta un mensaje custom como segundo
 * argumento de expect(), asi que el mensaje viaja dentro del array afirmado.
 */
import { USER_SERVICE_DEPARTMENTS } from '@/src/types/user';
import {
  SERVICE_DEPARTMENT_PERMISSION_DECISIONS,
  getPermissionsFromServiceAssignments,
} from '@/src/utils/permissions/permissions';

const deriveForEncargado = (department: string) =>
  getPermissionsFromServiceAssignments({
    servicePosition: 'encargado' as never,
    serviceDepartment: department as never,
  });

describe('SERVICE_DEPARTMENT_PERMISSION_DECISIONS coverage guard', () => {
  it('registra una decision para cada departamento de servicio asignable', () => {
    const failures = USER_SERVICE_DEPARTMENTS.filter(
      (department) =>
        !Object.prototype.hasOwnProperty.call(SERVICE_DEPARTMENT_PERMISSION_DECISIONS, department)
    ).map(
      (department) =>
        `'${department}' esta en USER_SERVICE_DEPARTMENTS pero no tiene entrada en ` +
        `SERVICE_DEPARTMENT_PERMISSION_DECISIONS. Añade entrada en ` +
        `SERVICE_DEPARTMENT_PERMISSION_DECISIONS con el motivo, o mapealo en ` +
        `assignmentToPermissions() (src/utils/permissions/permissions.ts).`
    );

    expect(failures).toEqual([]);
  });

  it('cada departamento documentado con motivo (string) no deriva permisos', () => {
    const failures = USER_SERVICE_DEPARTMENTS.filter((department) => {
      const decision = SERVICE_DEPARTMENT_PERMISSION_DECISIONS[department];
      if (decision === null) return false;
      return Object.keys(deriveForEncargado(department)).length > 0;
    }).map(
      (department) =>
        `'${department}' esta documentado como deliberadamente sin permisos ` +
        `('${SERVICE_DEPARTMENT_PERMISSION_DECISIONS[department]}') pero ` +
        `assignmentToPermissions() SI le otorga permisos. La documentacion miente: ` +
        `corrige SERVICE_DEPARTMENT_PERMISSION_DECISIONS o assignmentToPermissions() ` +
        `en src/utils/permissions/permissions.ts.`
    );

    expect(failures).toEqual([]);
  });

  it('cada departamento documentado como mapeado (null) SI deriva permisos', () => {
    const failures = USER_SERVICE_DEPARTMENTS.filter((department) => {
      const decision = SERVICE_DEPARTMENT_PERMISSION_DECISIONS[department];
      if (decision !== null) return false;
      return Object.keys(deriveForEncargado(department)).length === 0;
    }).map(
      (department) =>
        `'${department}' esta documentado como mapeado (null) en ` +
        `SERVICE_DEPARTMENT_PERMISSION_DECISIONS pero assignmentToPermissions() ` +
        `devolvio {}. Mapealo en assignmentToPermissions() ` +
        `(src/utils/permissions/permissions.ts) o cambia su entrada a un motivo documentado.`
    );

    expect(failures).toEqual([]);
  });
});
