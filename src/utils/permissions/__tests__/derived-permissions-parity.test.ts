import {
  assignmentToPermissions as backendAssignmentToPermissions,
  getPermissionsFromServiceAssignments as backendGetPermissions,
} from '../../../../functions/src/shared/derived-permissions';
import {
  assignmentToPermissions as clientAssignmentToPermissions,
  getPermissionsFromServiceAssignments as clientGetPermissions,
} from '@/src/utils/permissions/permissions';
import { USER_SERVICE_DEPARTMENTS } from '@/src/types/user';

const positions = ['encargado', 'auxiliar', 'apoyo', 'coordinador', 'secretario'] as const;

describe('derived permissions parity: client and Cloud Functions', () => {
  it.each(
    USER_SERVICE_DEPARTMENTS.flatMap((department) =>
      positions.map((position) => [position, department] as const)
    )
  )('%s:%s grants the same permissions', (position, department) => {
    const assignment = { position, department };
    expect(clientAssignmentToPermissions(assignment)).toEqual(backendAssignmentToPermissions(assignment));
  });

  it('merges legacy and multi-assignment data identically', () => {
    const user = {
      servicePosition: 'encargado',
      serviceDepartment: 'limpieza',
      serviceAssignments: [
        { position: 'auxiliar', department: 'tesoreria' },
        { position: 'encargado', department: 'hospitalidad' },
        { position: 'encargado', department: 'usuarios' },
      ],
    };

    expect(clientGetPermissions(user as Parameters<typeof clientGetPermissions>[0])).toEqual(
      backendGetPermissions(user)
    );
  });
});
