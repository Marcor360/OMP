import React from 'react';
import { View, ActivityIndicator, StyleSheet, type ViewStyle } from 'react-native';
import { ThemedText } from '@/src/components/themed-text';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

interface LoadingStateProps {
  message?: string;
  style?: ViewStyle;
  size?: 'small' | 'large';
}

export function LoadingState({
  message = 'Cargando...',
  style,
  size = 'large',
}: LoadingStateProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={size} color={colors.primary} />
      {message ? (
        <ThemedText style={styles.message}>{message}</ThemedText>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 12,
      padding: 32,
    },
    message: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
