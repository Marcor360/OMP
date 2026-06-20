import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/src/components/themed-text';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { useI18n } from '@/src/i18n';

export function UnauthorizedScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { t } = useI18n();

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="lock-closed" size={48} color={colors.error} />
      </View>
      <ThemedText style={styles.title}>{t('errors.unauthorized.title')}</ThemedText>
      <ThemedText style={styles.description}>
        {t('errors.unauthorized.description')}
      </ThemedText>
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace('/(protected)/(tabs)/' as any)}
        activeOpacity={0.8}
      >
        <Ionicons name="home-outline" size={18} color={colors.onPrimary} />
        <ThemedText style={styles.buttonText}>{t('errors.unauthorized.goHome')}</ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundDark,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
      gap: 16,
    },
    iconWrap: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.error + '22',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    description: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 24,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
    },
    buttonText: {
      color: colors.onPrimary,
      fontWeight: '700',
      fontSize: 15,
    },
  });
