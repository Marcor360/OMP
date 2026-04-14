import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useAppTheme, type ThemeMode } from '@/src/context/theme-context';
import { useI18n } from '@/src/i18n/index';
import { useAppColors } from '@/src/styles';

const THEME_OPTIONS: {
  mode: ThemeMode;
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: string;
}[] = [
  { mode: 'system', icon: 'phone-portrait-outline', labelKey: 'theme.option.system' },
  { mode: 'light', icon: 'sunny-outline', labelKey: 'theme.option.light' },
  { mode: 'dark', icon: 'moon-outline', labelKey: 'theme.option.dark' },
];

export function ThemeSelectorScreen() {
  const router = useRouter();
  const { themeMode, setThemeMode } = useAppTheme();
  const { t } = useI18n();
  const colors = useAppColors();
  const styles = createStyles(colors);

  const handleSelectTheme = async (mode: ThemeMode) => {
    await setThemeMode(mode);
  };

  return (
    <ScreenContainer>
      <View style={styles.container}>
        {/* Descripción */}
        <ThemedText style={styles.description} type="subtitle">
          {t('theme.description')}
        </ThemedText>

        {/* Opciones de tema */}
        <View style={styles.optionsContainer}>
          {THEME_OPTIONS.map((option) => {
            const isSelected = themeMode === option.mode;

            return (
              <TouchableOpacity
                key={option.mode}
                style={[
                  styles.optionRow,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => handleSelectTheme(option.mode)}
                activeOpacity={0.7}
              >
                <View style={styles.optionLeft}>
                  <View
                    style={[
                      styles.iconContainer,
                      {
                        backgroundColor: isSelected
                          ? `${colors.primary}20`
                          : `${colors.primary}10`,
                      },
                    ]}
                  >
                    <Ionicons
                      name={option.icon}
                      size={22}
                      color={isSelected ? colors.primary : colors.textSecondary}
                    />
                  </View>
                  <ThemedText style={styles.optionLabel}>
                    {t(option.labelKey as Parameters<typeof t>[0])}
                  </ThemedText>
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
            {themeMode === 'system'
              ? 'La aplicación usará el tema configurado en tu dispositivo.'
              : themeMode === 'light'
                ? 'La aplicación siempre usará el tema claro.'
                : 'La aplicación siempre usará el tema oscuro.'}
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
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionLabel: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.textPrimary,
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
