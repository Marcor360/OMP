import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useAuth } from '@/src/context/auth-context';
import { useI18n } from '@/src/i18n/index';
import { LANGUAGE_OPTIONS } from '@/src/i18n/language-options';
import { useAppColors } from '@/src/styles';

export function LanguageOnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { language, setLanguage, completeLanguageOnboarding, t } = useI18n();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const [saving, setSaving] = useState(false);

  const handleSelectLanguage = async (
    lang: (typeof LANGUAGE_OPTIONS)[number]['code']
  ) => {
    await setLanguage(lang);
  };

  const handleContinue = async () => {
    if (saving) return;

    setSaving(true);
    await completeLanguageOnboarding();
    router.replace(user ? ('/(protected)/(tabs)/' as never) : ('/(auth)/login' as never));
    setSaving(false);
  };

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title">{t('language.onboarding.title')}</ThemedText>
          <ThemedText style={styles.description}>
            {t('language.onboarding.subtitle')}
          </ThemedText>
        </View>

        <View style={styles.optionsContainer}>
          {LANGUAGE_OPTIONS.map((option) => {
            const isSelected = language === option.code;

            return (
              <TouchableOpacity
                key={option.code}
                style={[
                  styles.optionRow,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => handleSelectLanguage(option.code)}
                activeOpacity={0.75}
                disabled={saving}
              >
                <View style={styles.optionLeft}>
                  <View
                    style={[
                      styles.codeBadge,
                      {
                        backgroundColor: isSelected
                          ? `${colors.primary}20`
                          : `${colors.primary}10`,
                      },
                    ]}
                  >
                    <ThemedText style={styles.codeText}>
                      {option.code.toUpperCase()}
                    </ThemedText>
                  </View>
                  <View style={styles.textContainer}>
                    <ThemedText style={styles.optionLabel}>
                      {t(option.labelKey)}
                    </ThemedText>
                    <ThemedText style={styles.nativeName}>
                      {option.nativeName}
                    </ThemedText>
                  </View>
                </View>

                {isSelected ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={colors.primary}
                  />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.continueButton, saving && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <ThemedText style={styles.continueText}>
              {t('language.onboarding.continue')}
            </ThemedText>
          )}
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const createStyles = (colors: ReturnType<typeof useAppColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      gap: 18,
    },
    header: {
      gap: 8,
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    optionsContainer: {
      gap: 10,
      flex: 1,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: 1,
      borderRadius: 12,
    },
    optionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    codeBadge: {
      width: 42,
      height: 42,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    codeText: {
      fontSize: 13,
      fontWeight: '800',
    },
    textContainer: {
      gap: 2,
    },
    optionLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    nativeName: {
      fontSize: 12,
      color: colors.textMuted,
    },
    continueButton: {
      marginTop: 8,
      borderRadius: 10,
      backgroundColor: colors.primary,
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    continueText: {
      color: colors.onPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    buttonDisabled: {
      opacity: 0.7,
    },
  });
