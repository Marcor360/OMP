import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useI18n } from '@/src/i18n/index';
import { LANGUAGE_OPTIONS } from '@/src/i18n/language-options';
import { useAppColors } from '@/src/styles';

export function LanguageSelectorScreen() {
  const { language, setLanguage, t } = useI18n();
  const colors = useAppColors();
  const styles = createStyles(colors);

  const handleSelectLanguage = async (lang: (typeof LANGUAGE_OPTIONS)[number]['code']) => {
    await setLanguage(lang);
  };

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <ThemedText style={styles.description} type="subtitle">
          {t('language.description')}
        </ThemedText>

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
                      styles.codeBadge,
                      {
                        backgroundColor: isSelected ? `${colors.primary}20` : `${colors.primary}10`,
                      },
                    ]}
                  >
                    <ThemedText style={styles.codeText}>{option.code.toUpperCase()}</ThemedText>
                  </View>
                  <View style={styles.textContainer}>
                    <ThemedText style={styles.optionLabel}>{t(option.labelKey)}</ThemedText>
                    <ThemedText style={styles.nativeName}>{option.nativeName}</ThemedText>
                  </View>
                </View>

                {isSelected ? <Ionicons name="checkmark-circle" size={24} color={colors.primary} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.infoContainer}>
          <ThemedText style={styles.infoText} type="default">
            {t('language.info')}
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
    codeBadge: {
      width: 44,
      height: 44,
      borderRadius: 12,
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
