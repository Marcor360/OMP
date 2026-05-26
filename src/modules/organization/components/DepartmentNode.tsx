import type { OrganizationTreeNode } from '@/src/modules/organization/types/organization.types';
import { OrganizationNode } from '@/src/modules/organization/components/OrganizationNode';

type DepartmentNodeProps = {
  node: OrganizationTreeNode;
  canEdit?: boolean;
  compact?: boolean;
  onEdit?: (node: OrganizationTreeNode) => void;
};

export function DepartmentNode(props: DepartmentNodeProps) {
  return <OrganizationNode {...props} />;
}
