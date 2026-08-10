import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/src/components/themed-text';
import { AvatarSize, useAppColors } from '@/src/styles';
import { getInitials } from '@/src/utils/ui/initials';

interface AvatarProps {
  /** Nombre completo; se derivan las iniciales. */
  name: string;
  size?: keyof typeof AvatarSize;
  /** Color de acento; default colors.primary. Tine fondo (20%) y texto. */
  tone?: string;
  /** Icono opcional en lugar de iniciales. */
  icon?: keyof typeof Ionicons.glyphMap;
}

const FONT_SIZE_BY_SIZE: Record<keyof typeof AvatarSize, number> = {
  sm: 12,
  md: 14,
  lg: 18,
  xl: 28,
};

const ICON_SIZE_RATIO = 0.5;

function AvatarBase({ name, size = 'md', tone, icon }: AvatarProps) {
  const colors = useAppColors();
  const diameter = AvatarSize[size];
  const accent = tone ?? colors.primary;
  const styles = createStyles(diameter, accent);

  return (
    <View style={styles.container}>
      {icon ? (
        <Ionicons name={icon} size={diameter * ICON_SIZE_RATIO} color={accent} />
      ) : (
        <ThemedText style={[styles.initials, { fontSize: FONT_SIZE_BY_SIZE[size] }]}>
          {getInitials(name)}
        </ThemedText>
      )}
    </View>
  );
}

const createStyles = (diameter: number, accent: string) =>
  StyleSheet.create({
    container: {
      width: diameter,
      height: diameter,
      borderRadius: diameter / 2,
      backgroundColor: `${accent}20`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initials: {
      color: accent,
      fontWeight: '700',
    },
  });

export const Avatar = memo(AvatarBase);
export type { AvatarProps };
