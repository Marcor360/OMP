import type { AppUser } from '@/src/types/user';
import {
  type Department,
  type DepartmentAssignment,
  type OrganizationPosition,
} from '@/src/modules/organization/types/organization.types';

export type AssignmentValidationInput = {
  assignment: Omit<DepartmentAssignment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
  departments: Department[];
  assignments: DepartmentAssignment[];
  users: AppUser[];
};

const VALID_POSITIONS: OrganizationPosition[] = [
  'coordinador',
  'secretario',
  'encargado',
  'auxiliar',
  'apoyo',
];

export const validateDepartmentAssignment = ({
  assignment,
  departments,
  assignments,
  users,
}: AssignmentValidationInput): void => {
  if (!assignment.congregationId?.trim()) throw new Error('La congregacion es obligatoria.');
  if (!assignment.departmentId?.trim()) throw new Error('El departamento es obligatorio.');
  if (!assignment.userId?.trim()) throw new Error('El usuario es obligatorio.');
  if (!VALID_POSITIONS.includes(assignment.position)) throw new Error('El puesto no es valido.');
  if (!assignment.title?.trim()) throw new Error('El titulo es obligatorio.');
  if (!assignment.displayName?.trim()) throw new Error('El nombre del usuario es obligatorio.');
  if (typeof assignment.isActive !== 'boolean') throw new Error('El estado de la asignacion no es valido.');

  if (assignment.position === 'coordinador' && assignment.departmentId !== 'coordinacion') {
    throw new Error('El coordinador debe estar en el departamento de Coordinacion.');
  }

  if (assignment.position === 'secretario' && assignment.departmentId !== 'secretaria') {
    throw new Error('El secretario debe estar en el departamento de Secretaria.');
  }

  const department = departments.find(
    (item) => item.id === assignment.departmentId && item.isActive
  );
  if (!department) throw new Error('El departamento no existe o esta inactivo.');

  const user = users.find((item) => item.uid === assignment.userId);
  if (!user) throw new Error('El usuario seleccionado no existe.');
  if (user.congregationId !== assignment.congregationId) {
    throw new Error('El usuario seleccionado pertenece a otra congregacion.');
  }
  if (user.isActive !== true) throw new Error('No se pueden asignar usuarios inactivos.');

  if (!assignment.isActive) return;

  const activeAssignments = assignments.filter(
    (item) => item.isActive && item.id !== assignment.id
  );

  if (
    assignment.position === 'coordinador' &&
    activeAssignments.some(
      (item) => item.position === 'coordinador' && item.departmentId === 'coordinacion'
    )
  ) {
    throw new Error('Ya existe un coordinador activo.');
  }

  if (
    assignment.position === 'secretario' &&
    activeAssignments.some(
      (item) => item.position === 'secretario' && item.departmentId === 'secretaria'
    )
  ) {
    throw new Error('Ya existe un secretario activo.');
  }

  if (
    assignment.position === 'encargado' &&
    !department.allowMultipleManagers &&
    activeAssignments.some(
      (item) =>
        item.position === 'encargado' &&
        item.departmentId === assignment.departmentId
    )
  ) {
    throw new Error(`Ya existe un encargado activo para ${department.name}.`);
  }

  if (
    assignment.position === 'auxiliar' &&
    !department.allowMultipleAssistants &&
    activeAssignments.some(
      (item) =>
        item.position === 'auxiliar' &&
        item.departmentId === assignment.departmentId
    )
  ) {
    throw new Error(`Este departamento no permite multiples auxiliares.`);
  }

  if (
    activeAssignments.some(
      (item) =>
        item.userId === assignment.userId &&
        item.departmentId === assignment.departmentId &&
        item.position === assignment.position
    )
  ) {
    throw new Error('Este usuario ya tiene esa asignacion activa.');
  }
};
