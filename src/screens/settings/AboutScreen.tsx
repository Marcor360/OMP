import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ThemedText } from '@/src/components/themed-text';
import { useI18n } from '@/src/i18n/index';
import { useAppColors } from '@/src/styles';
import * as Application from 'expo-application';
import Constants from 'expo-constants';

export function AboutScreen() {
  const { t } = useI18n();
  const colors = useAppColors();
  const styles = createStyles(colors);

  // Application.native* solo existe en iOS/Android; en web se usa el config de Expo
  // (app.json) directamente, así que ambos quedan siempre sincronizados con una sola fuente.
  const appVersion =
    Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '—';
  const buildVersion =
    Application.nativeBuildVersion ??
    (Constants.expoConfig?.ios as { buildNumber?: string } | undefined)?.buildNumber ??
    '3';

  return (
    <ScreenContainer scrollable={false} padded={false}>
      <PageHeader title={t('settings.screen.about')} showBack />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Ícono de la aplicación */}
        <View style={styles.iconContainer}>
          <View
            style={[
              styles.iconBackground,
              { backgroundColor: `${colors.primary}15` },
            ]}
          >
            <Ionicons name="people-circle" size={48} color={colors.primary} />
          </View>
        </View>

        {/* Título */}
        <ThemedText style={styles.title} type="title">
          {t('about.title')}
        </ThemedText>

        {/* Descripción */}
        <View style={styles.descriptionContainer}>
          <ThemedText style={styles.description}>
            {t('about.description')}
          </ThemedText>
        </View>

        {/* Información de versión */}
        <View style={styles.versionContainer}>
          <View style={styles.versionRow}>
            <ThemedText style={styles.versionLabel}>
              {t('about.version')}
            </ThemedText>
            <ThemedText style={styles.versionValue}>{appVersion}</ThemedText>
          </View>
          <View style={styles.versionRow}>
            <ThemedText style={styles.versionLabel}>
              {t('about.build')}
            </ThemedText>
            <ThemedText style={styles.versionValue}>{buildVersion}</ThemedText>
          </View>
        </View>

        {/* Información legal */}
        <View style={styles.legalContainer}>
          <ThemedText style={styles.legalText}>
            © {new Date().getFullYear()} OMP. Todos los derechos reservados.
          </ThemedText>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const createStyles = (colors: ReturnType<typeof useAppColors>) =>
  StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      padding: 24,
      gap: 24,
      alignItems: 'center',
    },
    iconContainer: {
      marginTop: 24,
    },
    iconBackground: {
      width: 96,
      height: 96,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      textAlign: 'center',
    },
    descriptionContainer: {
      width: '100%',
      paddingHorizontal: 8,
    },
    description: {
      fontSize: 15,
      lineHeight: 24,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    versionContainer: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 12,
    },
    versionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    versionLabel: {
      fontSize: 14,
      color: colors.textMuted,
    },
    versionValue: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    legalContainer: {
      marginTop: 16,
      paddingHorizontal: 8,
    },
    legalText: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
