import React, { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Chip } from '@/src/components/ui/Chip';
import { Spacing } from '@/src/styles';

interface ChipGroupOption {
  value: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface ChipGroupProps {
  options: ChipGroupOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
}

function ChipGroupBase({ options, value, onChange, multiple = false }: ChipGroupProps) {
  const selectedValues = Array.isArray(value) ? value : [value];

  const handlePress = useCallback(
    (optionValue: string) => {
      if (!multiple) {
        onChange(optionValue);
        return;
      }

      const current = Array.isArray(value) ? value : [];
      const next = current.includes(optionValue)
        ? current.filter((entry) => entry !== optionValue)
        : [...current, optionValue];
      onChange(next);
    },
    [multiple, onChange, value]
  );

  return (
    <View style={styles.container}>
      {options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          icon={option.icon}
          active={selectedValues.includes(option.value)}
          onPress={() => handlePress(option.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
});

export const ChipGroup = memo(ChipGroupBase);
export type { ChipGroupProps, ChipGroupOption };
