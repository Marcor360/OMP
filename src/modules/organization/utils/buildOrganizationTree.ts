import {
  type BuildOrganizationTreeInput,
  type BuildOrganizationTreeResult,
  type DepartmentAssignment,
  type OrganizationPosition,
  type OrganizationTreeNode,
} from '@/src/modules/organization/types/organization.types';

const PERSON_POSITION_ORDER: Record<OrganizationPosition, number> = {
  coordinador: 0,
  secretario: 1,
  encargado: 2,
  auxiliar: 3,
  apoyo: 4,
};

const personNodeId = (assignment: DepartmentAssignment): string =>
  `person_${assignment.departmentId}_${assignment.position}_${assignment.userId}`;

const toPersonNode = (
  assignment: DepartmentAssignment,
  level: number,
  parentId: string | null
): OrganizationTreeNode => ({
  id: personNodeId(assignment),
  type: 'person',
  assignmentId: assignment.id,
  userId: assignment.userId,
  displayName: assignment.displayName,
  title: assignment.title,
  departmentId: assignment.departmentId,
  departmentName: assignment.departmentName,
  position: assignment.position,
  level,
  order: assignment.order,
  parentId,
  children: [],
});

const sortAssignments = (a: DepartmentAssignment, b: DepartmentAssignment): number =>
  PERSON_POSITION_ORDER[a.position] - PERSON_POSITION_ORDER[b.position] ||
  a.order - b.order ||
  a.displayName.localeCompare(b.displayName, 'es');

const attachInternalPersonHierarchy = (
  departmentNode: OrganizationTreeNode,
  assignments: DepartmentAssignment[]
) => {
  const nodesByAssignmentId = new Map<string, OrganizationTreeNode>();

  assignments.sort(sortAssignments).forEach((assignment) => {
    if (assignment.parentAssignmentId) {
      const parent = nodesByAssignmentId.get(assignment.parentAssignmentId);
      if (parent) {
        const child = toPersonNode(assignment, parent.level + 1, parent.id);
        parent.children.push(child);
        nodesByAssignmentId.set(assignment.id, child);
        return;
      }
    }

    const node = toPersonNode(assignment, departmentNode.level + 1, departmentNode.id);
    departmentNode.children.push(node);
    nodesByAssignmentId.set(assignment.id, node);
  });
};

export const buildOrganizationTree = ({
  departments,
  assignments,
}: BuildOrganizationTreeInput): BuildOrganizationTreeResult => {
  const activeDepartments = departments
    .filter((department) => department.isActive)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es'));
  const activeAssignments = assignments.filter((assignment) => assignment.isActive);
  const warnings: string[] = [];

  const coordinatorAssignment = activeAssignments
    .filter(
      (assignment) =>
        assignment.position === 'coordinador' &&
        assignment.departmentId === 'coordinacion'
    )
    .sort(sortAssignments)[0];

  const secretaryAssignment = activeAssignments
    .filter(
      (assignment) =>
        assignment.position === 'secretario' &&
        assignment.departmentId === 'secretaria'
    )
    .sort(sortAssignments)[0];

  const operationalDepartments = activeDepartments.filter(
    (department) => department.id !== 'coordinacion' && department.id !== 'secretaria'
  );

  if (!coordinatorAssignment) {
    warnings.push('Falta asignar un coordinador para construir el organigrama.');

    const roots = operationalDepartments.map((department) => {
      const node: OrganizationTreeNode = {
        id: `department_${department.id}`,
        type: 'department',
        displayName: department.name,
        title: 'Departamento',
        departmentId: department.id,
        departmentName: department.name,
        level: 0,
        order: department.order,
        parentId: null,
        children: [],
      };

      attachInternalPersonHierarchy(
        node,
        activeAssignments.filter(
          (assignment) =>
            assignment.departmentId === department.id &&
            assignment.position !== 'coordinador' &&
            assignment.position !== 'secretario'
        )
      );

      return node;
    });

    return {
      roots,
      warnings,
      isComplete: false,
    };
  }

  const coordinatorNode = toPersonNode(coordinatorAssignment, 0, null);
  let departmentsParent = coordinatorNode;
  let departmentsLevel = 1;

  if (!secretaryAssignment) {
    warnings.push('Falta asignar un secretario para completar el organigrama.');
  } else {
    const secretaryNode = toPersonNode(secretaryAssignment, 1, coordinatorNode.id);
    coordinatorNode.children.push(secretaryNode);
    departmentsParent = secretaryNode;
    departmentsLevel = 2;
  }

  operationalDepartments.forEach((department) => {
    const departmentNode: OrganizationTreeNode = {
      id: `department_${department.id}`,
      type: 'department',
      displayName: department.name,
      title: 'Departamento',
      departmentId: department.id,
      departmentName: department.name,
      level: departmentsLevel,
      order: department.order,
      parentId: departmentsParent.id,
      children: [],
    };

    attachInternalPersonHierarchy(
      departmentNode,
      activeAssignments.filter(
        (assignment) =>
          assignment.departmentId === department.id &&
          assignment.position !== 'coordinador' &&
          assignment.position !== 'secretario'
      )
    );

    departmentsParent.children.push(departmentNode);
  });

  departmentsParent.children.sort((a, b) => a.order - b.order || a.displayName.localeCompare(b.displayName, 'es'));

  return {
    roots: [coordinatorNode],
    warnings,
    isComplete: Boolean(coordinatorAssignment && secretaryAssignment),
  };
};
