import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useI18n, type SupportedLanguage } from '@/src/i18n/index';
import { useAppColors } from '@/src/styles';

const LANGUAGE_OPTIONS: {
  code: SupportedLanguage;
  flag: string;
  nativeName: string;
  labelKey: string;
}[] = [
  { code: 'es', flag: '🇪🇸', nativeName: 'Español', labelKey: 'language.option.es' },
  { code: 'en', flag: '🇺🇸', nativeName: 'English', labelKey: 'language.option.en' },
];

export function LanguageSelectorScreen() {
  const router = useRouter();
  const { language, setLanguage, t } = useI18n();
  const colors = useAppColors();
  const styles = createStyles(colors);

  const handleSelectLanguage = async (lang: SupportedLanguage) => {
    await setLanguage(lang);
  };

  return (
    <ScreenContainer>
      <View style={styles.container}>
        {/* Descripción */}
        <ThemedText style={styles.description} type="subtitle">
          {t('language.description')}
        </ThemedText>

        {/* Opciones de idioma */}
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
                activeOpacity={0.7}
              >
                <View style={styles.optionLeft}>
                  <View
                    style={[
                      styles.flagContainer,
                      {
                        backgroundColor: isSelected
                          ? `${colors.primary}20`
                          : `${colors.primary}10`,
                      },
                    ]}
                  >
                    <ThemedText style={styles.flagEmoji}>{option.flag}</ThemedText>
                  </View>
                  <View style={styles.textContainer}>
                    <ThemedText style={styles.optionLabel}>
                      {t(option.labelKey as Parameters<typeof t>[0])}
                    </ThemedText>
                    <ThemedText style={styles.nativeName}>
                      {option.nativeName}
                    </ThemedText>
                  </View>
                </View>

                {isSelected && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Información adicional */}
        <View style={styles.infoContainer}>
          <ThemedText style={styles.infoText} type="default">
            {language === 'es'
              ? 'El idioma se ha cambiado a español. Algunos contenidos pueden permanecer en inglés si no han sido traducidos.'
              : 'Language changed to English. Some content may remain in Spanish if not yet translated.'}
          </ThemedText>
        </View>
      </View>
    </ScreenContainer>
  );
}

const createStyles = (colors: ReturnType<typeof useAppColors>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      gap: 24,
    },
    description: {
      fontSize: 15,
      color: colors.textSecondary,
      paddingHorizontal: 4,
    },
    optionsContainer: {
      gap: 12,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
    },
    optionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    flagContainer: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    flagEmoji: {
      fontSize: 24,
    },
    textContainer: {
      gap: 2,
    },
    optionLabel: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.textPrimary,
    },
    nativeName: {
      fontSize: 13,
      color: colors.textMuted,
    },
    infoContainer: {
      marginTop: 8,
      paddingHorizontal: 12,
    },
    infoText: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 20,
    },
  });
