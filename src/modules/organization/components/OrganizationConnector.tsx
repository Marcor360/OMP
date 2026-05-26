import { StyleSheet, View } from 'react-native';

import { useAppColors } from '@/src/styles';

type OrganizationConnectorProps = {
  type?: 'vertical' | 'horizontal';
  length?: number;
};

export function OrganizationConnector({ type = 'vertical', length = 32 }: OrganizationConnectorProps) {
  const colors = useAppColors();

  return (
    <View
      style={[
        type === 'vertical'
          ? { width: 2, height: length }
          : { height: 2, width: length },
        { backgroundColor: colors.border },
        styles.line,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  line: {
    flexShrink: 0,
  },
});
