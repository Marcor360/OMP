import {getRenderableOrganizationChildren} from '../../utils/organizationTreeGuards';
import type {OrganizationTreeNode} from '../../types/organization.types';

const node = (id: string, children: OrganizationTreeNode[] = []): OrganizationTreeNode => ({
  id, type: 'person', displayName: id, title: id, level: 0, order: 0, children,
});

describe('OrganizationTreeDesktop guards', () => {
  it('supports five levels', () => {
    const fifth = node('5'); const fourth = node('4', [fifth]); const third = node('3', [fourth]);
    const second = node('2', [third]); const first = node('1', [second]);
    let current = first; const seen = new Set<string>();
    for (let depth = 0; depth < 4; depth += 1) {
      seen.add(current.id);
      const children = getRenderableOrganizationChildren(current, seen, depth);
      expect(children).toHaveLength(1); current = children[0];
    }
    expect(current.id).toBe('5');
  });

  it('cuts circular and repeated nodes', () => {
    const repeated = node('child');
    const root = node('root', [repeated, repeated, node('root')]);
    expect(getRenderableOrganizationChildren(root, new Set(['root']), 0).map((item) => item.id)).toEqual(['child']);
  });
});
