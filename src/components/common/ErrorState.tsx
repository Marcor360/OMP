import React from 'react';
import { View, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/src/components/themed-text';
import { useOptionalI18n } from '@/src/i18n/index';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  style?: ViewStyle;
}

export function ErrorState({
  message,
  onRetry,
  style,
}: ErrorStateProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const i18n = useOptionalI18n();
  const resolvedMessage = message ?? i18n?.t('common.unexpectedError') ?? 'Ocurrio un error. Intenta nuevamente.';

  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconWrap}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
      </View>
      <ThemedText style={styles.title}>{i18n?.t('common.somethingWentWrong') ?? 'Algo salio mal'}</ThemedText>
      <ThemedText style={styles.message}>{resolvedMessage}</ThemedText>
      {onRetry ? (
        <TouchableOpacity style={styles.button} onPress={onRetry} activeOpacity={0.8}>
          <Ionicons name="refresh" size={16} color={colors.onPrimary} />
          <ThemedText style={styles.buttonText}>{i18n?.t('common.retry') ?? 'Reintentar'}</ThemedText>
        </TouchableOpacity>
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
      padding: 32,
      gap: 12,
    },
    iconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.errorLight + '22',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    message: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
    button: {
      marginTop: 8,
      backgroundColor: colors.error,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    buttonText: {
      color: colors.onPrimary,
      fontWeight: '600',
      fontSize: 14,
    },
  });
