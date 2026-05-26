import { ScrollView, StyleSheet, View } from 'react-native';

import { OrganizationConnector } from '@/src/modules/organization/components/OrganizationConnector';
import { OrganizationNode } from '@/src/modules/organization/components/OrganizationNode';
import type { OrganizationTreeNode } from '@/src/modules/organization/types/organization.types';
import { useAppColors } from '@/src/styles';

type OrganizationTreeDesktopProps = {
  roots: OrganizationTreeNode[];
  canEdit?: boolean;
  compact?: boolean;
  onEdit?: (node: OrganizationTreeNode) => void;
};

const renderDepartmentBranch = (
  node: OrganizationTreeNode,
  canEdit: boolean,
  compact: boolean,
  onEdit?: (node: OrganizationTreeNode) => void
) => (
  <View key={node.id} style={styles.branch}>
    <OrganizationNode node={node} canEdit={canEdit} compact={compact} onEdit={onEdit} />
    {node.children.length > 0 ? (
      <>
        <OrganizationConnector length={28} />
        <View style={styles.peopleColumn}>
          {node.children.map((child) => (
            <View key={child.id} style={styles.personStack}>
              <OrganizationNode node={child} canEdit={canEdit} compact={compact} onEdit={onEdit} />
              {child.children.length > 0 ? (
                <>
                  <OrganizationConnector length={22} />
                  <View style={styles.peopleColumn}>
                    {child.children.map((nested) => (
                      <OrganizationNode
                        key={nested.id}
                        node={nested}
                        canEdit={canEdit}
                        compact={compact}
                        onEdit={onEdit}
                      />
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          ))}
        </View>
      </>
    ) : null}
  </View>
);

export function OrganizationTreeDesktop({
  roots,
  canEdit = false,
  compact = false,
  onEdit,
}: OrganizationTreeDesktopProps) {
  const colors = useAppColors();
  const root = roots[0];
  const secretary = root?.children.find((child) => child.position === 'secretario');
  const departmentParent = secretary ?? root;
  const departments = departmentParent?.children.filter((child) => child.type === 'department') ?? [];

  if (!root) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.horizontalContent}>
      <ScrollView showsVerticalScrollIndicator contentContainerStyle={styles.verticalContent}>
        <View style={styles.tree}>
          <OrganizationNode node={root} isRoot canEdit={canEdit} compact={compact} onEdit={onEdit} />

          {secretary ? (
            <>
              <OrganizationConnector length={34} />
              <OrganizationNode node={secretary} canEdit={canEdit} compact={compact} onEdit={onEdit} />
            </>
          ) : null}

          {departments.length > 0 ? (
            <>
              <OrganizationConnector length={34} />
              <View style={[styles.departmentRail, { backgroundColor: colors.border }]} />
              <View style={styles.departmentsRow}>
                {departments.map((department) => (
                  <View key={department.id} style={styles.departmentBranchWrap}>
                    <OrganizationConnector length={26} />
                    {renderDepartmentBranch(department, canEdit, compact, onEdit)}
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  horizontalContent: {
    minWidth: '100%',
    paddingVertical: 10,
  },
  verticalContent: {
    flexGrow: 1,
  },
  tree: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  departmentRail: {
    height: 2,
    minWidth: 220,
    alignSelf: 'stretch',
    marginHorizontal: 110,
  },
  departmentsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 36,
  },
  departmentBranchWrap: {
    alignItems: 'center',
  },
  branch: {
    alignItems: 'center',
    width: 220,
  },
  peopleColumn: {
    alignItems: 'center',
    gap: 12,
    width: 220,
  },
  personStack: {
    alignItems: 'center',
    gap: 0,
    width: 220,
  },
});
