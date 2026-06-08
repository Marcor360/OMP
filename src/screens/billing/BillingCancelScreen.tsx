import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useI18n } from '@/src/i18n/index';
import { type AppColors, useAppColors } from '@/src/styles';

export function BillingCancelScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <ScreenContainer>
      <PageHeader title={t('billing.cancel.title')} showBack fallbackRoute="/(protected)/billing" />
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="close-circle-outline" size={44} color={colors.warningDark} />
        </View>
        <ThemedText style={styles.title}>{t('billing.cancel.heading')}</ThemedText>
        <ThemedText style={styles.description}>
          {t('billing.cancel.description')}
        </ThemedText>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace('/(protected)/billing' as never)}
        >
          <ThemedText style={styles.buttonText}>{t('billing.cancel.back')}</ThemedText>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      paddingHorizontal: 18,
    },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.warningLight,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: '800',
      textAlign: 'center',
    },
    description: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    button: {
      marginTop: 10,
      minHeight: 44,
      borderRadius: 8,
      paddingHorizontal: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {
      color: colors.onPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
  });
