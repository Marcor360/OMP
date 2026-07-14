import {ScrollView, StyleSheet, View} from 'react-native';

import {OrganizationConnector} from '@/src/modules/organization/components/OrganizationConnector';
import {OrganizationNode} from '@/src/modules/organization/components/OrganizationNode';
import type {OrganizationTreeNode} from '@/src/modules/organization/types/organization.types';
import {getRenderableOrganizationChildren, MAX_ORGANIZATION_TREE_CHILDREN} from '@/src/modules/organization/utils/organizationTreeGuards';
import {useAppColors} from '@/src/styles';

type Props = {roots: OrganizationTreeNode[]; canEdit?: boolean; compact?: boolean; onEdit?: (node: OrganizationTreeNode) => void};
const Branch = ({node, canEdit, compact, onEdit, ancestors, depth}: Props & {
  node: OrganizationTreeNode; ancestors: ReadonlySet<string>; depth: number;
}) => {
  const nextAncestors = new Set(ancestors).add(node.id);
  const children = getRenderableOrganizationChildren(node, nextAncestors, depth);
  return (
    <View style={styles.branch}>
      <OrganizationNode node={node} isRoot={depth === 0} canEdit={canEdit} compact={compact} onEdit={onEdit} />
      {children.length ? <>
        <OrganizationConnector length={depth === 0 ? 34 : 24} />
        <View style={children.length > 1 ? styles.row : styles.column}>
          {children.map((child) => <Branch key={child.id} roots={[]} node={child} canEdit={canEdit}
            compact={compact} onEdit={onEdit} ancestors={nextAncestors} depth={depth + 1} />)}
        </View>
      </> : null}
    </View>
  );
};

export function OrganizationTreeDesktop({roots, canEdit = false, compact = false, onEdit}: Props) {
  const colors = useAppColors();
  const uniqueRoots = roots.filter((root, index) => root?.id && roots.findIndex((item) => item.id === root.id) === index);
  if (!uniqueRoots.length) return null;
  return <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.horizontalContent}>
    <ScrollView showsVerticalScrollIndicator contentContainerStyle={styles.verticalContent}>
      <View style={[styles.roots, {borderColor: colors.border}]}>
        {uniqueRoots.slice(0, MAX_ORGANIZATION_TREE_CHILDREN).map((root) => <Branch key={root.id} roots={[]} node={root}
          canEdit={canEdit} compact={compact} onEdit={onEdit} ancestors={new Set()} depth={0} />)}
      </View>
    </ScrollView>
  </ScrollView>;
}

const styles = StyleSheet.create({
  horizontalContent: {minWidth: '100%', paddingVertical: 10},
  verticalContent: {flexGrow: 1},
  roots: {alignItems: 'center', paddingHorizontal: 24, paddingBottom: 28, gap: 36},
  branch: {alignItems: 'center', minWidth: 220},
  row: {flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 36},
  column: {alignItems: 'center', gap: 12},
});
