import { StyleSheet, View } from 'react-native';

import { OrganizationNode } from '@/src/modules/organization/components/OrganizationNode';
import type { OrganizationTreeNode } from '@/src/modules/organization/types/organization.types';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

type OrganizationTreeMobileProps = {
  roots: OrganizationTreeNode[];
  canEdit?: boolean;
  onEdit?: (node: OrganizationTreeNode) => void;
};

const renderNode = (
  node: OrganizationTreeNode,
  colors: AppColorSet,
  canEdit: boolean,
  onEdit: ((node: OrganizationTreeNode) => void) | undefined,
  depth = 0
) => (
  <View key={node.id} style={styles.mobileNode}>
    <View style={styles.nodeRow}>
      {depth > 0 ? (
        <View style={styles.indentWrap}>
          {Array.from({ length: depth }).map((_, index) => (
            <View key={`${node.id}-${index}`} style={[styles.indentLine, { backgroundColor: colors.border }]} />
          ))}
        </View>
      ) : null}
      <View style={styles.mobileCardWrap}>
        <OrganizationNode node={node} canEdit={canEdit} compact onEdit={onEdit} isRoot={depth === 0} />
      </View>
    </View>

    {node.children.length > 0 ? (
      <View style={styles.children}>
        {node.children.map((child) => renderNode(child, colors, canEdit, onEdit, depth + 1))}
      </View>
    ) : null}
  </View>
);

export function OrganizationTreeMobile({
  roots,
  canEdit = false,
  onEdit,
}: OrganizationTreeMobileProps) {
  const colors = useAppColors();

  return (
    <View style={styles.mobileTree}>
      {roots.map((root) => renderNode(root, colors, canEdit, onEdit))}
    </View>
  );
}

const styles = StyleSheet.create({
  mobileTree: {
    gap: 12,
  },
  mobileNode: {
    gap: 8,
  },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  indentWrap: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  indentLine: {
    width: 2,
    borderRadius: 2,
  },
  mobileCardWrap: {
    flex: 1,
    minWidth: 0,
  },
  children: {
    gap: 10,
  },
});
