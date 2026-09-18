import { parseServicePosition, buildServiceAssignmentLabel, normalizeAssignmentForRole } from '../users/parsers.js';
import { getPermissionsFromServiceAssignments } from '../shared/derived-permissions.js';

describe('service position apoyo compatibility', () => {
  it('parses and preserves apoyo assignments', () => {
    expect(parseServicePosition('apoyo')).toBe('apoyo');
    expect(buildServiceAssignmentLabel('apoyo', 'limpieza')).toBe('Apoyo de Limpieza');
    expect(normalizeAssignmentForRole('user', 'apoyo', 'limpieza')).toEqual({
      position: 'apoyo', department: 'limpieza', label: 'Apoyo de Limpieza',
    });
  });

  it('does not grant derived permissions for apoyo', () => {
    expect(getPermissionsFromServiceAssignments({ servicePosition: 'apoyo', serviceDepartment: 'limpieza' })).toEqual({});
  });
});
