import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/src/components/themed-text';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { useOptionalI18n } from '@/src/i18n/index';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  fallbackRoute?: string;
  actions?: React.ReactNode;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
}

export function PageHeader({
  title,
  subtitle,
  showBack = false,
  fallbackRoute,
  actions,
  rightAction,
  style,
}: PageHeaderProps) {
  const router = useRouter();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const i18n = useOptionalI18n();
  const headerAction = actions ?? rightAction;
  const handleBack = () => {
    if (router.canGoBack?.()) {
      router.back();
      return;
    }

    router.replace((fallbackRoute ?? '/(protected)/(tabs)') as never);
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.left}>
        {showBack && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={i18n?.t('common.back') ?? "Volver"}
          >
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
        <View style={styles.titleBlock}>
          <ThemedText style={styles.title} numberOfLines={1}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
      </View>
      {headerAction ? <View style={styles.actions}>{headerAction}</View> : null}
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.backgroundDark,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      minHeight: 60,
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 8,
    },
    backButton: {
      padding: 4,
      marginRight: 4,
    },
    titleBlock: {
      flex: 1,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.textPrimary,
      lineHeight: 24,
    },
    subtitle: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginLeft: 8,
    },
  });
