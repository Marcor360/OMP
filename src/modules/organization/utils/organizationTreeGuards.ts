import type {OrganizationTreeNode} from '@/src/modules/organization/types/organization.types';

export const MAX_ORGANIZATION_TREE_DEPTH = 20;
export const MAX_ORGANIZATION_TREE_CHILDREN = 100;

export const getRenderableOrganizationChildren = (
  node: OrganizationTreeNode,
  ancestors: ReadonlySet<string>,
  depth: number
): OrganizationTreeNode[] => {
  if (depth >= MAX_ORGANIZATION_TREE_DEPTH) return [];
  const unique = new Set<string>();
  return node.children.filter((child) => {
    if (!child?.id || ancestors.has(child.id) || unique.has(child.id)) return false;
    unique.add(child.id);
    return true;
  }).slice(0, MAX_ORGANIZATION_TREE_CHILDREN);
};
