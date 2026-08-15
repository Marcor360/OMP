import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import { useAuth } from '@/src/context/auth-context';
import { useUser } from '@/src/context/user-context';
import { useI18n } from '@/src/i18n';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

export type InvalidSessionReason =
  | 'PROFILE_MISSING'
  | 'ACCOUNT_INACTIVE'
  | 'NO_CONGREGATION'
  | 'PROFILE_ERROR';

interface InvalidSessionScreenProps {
  reason: InvalidSessionReason;
}

export function InvalidSessionScreen({ reason }: InvalidSessionScreenProps) {
  const { logout } = useAuth();
  const { refreshProfile, loadingProfile } = useUser();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { t } = useI18n();

  const copy = {
    PROFILE_MISSING: {
      title: t('errors.invalidSession.profileMissingTitle'),
      description: t('errors.invalidSession.profileMissingDescription'),
    },
    ACCOUNT_INACTIVE: {
      title: t('errors.invalidSession.accountInactiveTitle'),
      description: t('errors.invalidSession.accountInactiveDescription'),
    },
    NO_CONGREGATION: {
      title: t('errors.invalidSession.noCongregationTitle'),
      description: t('errors.invalidSession.noCongregationDescription'),
    },
    PROFILE_ERROR: {
      title: t('errors.invalidSession.profileErrorTitle'),
      description: t('errors.invalidSession.profileErrorDescription'),
    },
  }[reason];

  return (
    <View style={styles.container} accessibilityRole="alert">
      <View style={styles.iconWrap}>
        <Ionicons name="person-remove-outline" size={46} color={colors.error} />
      </View>

      <ThemedText style={styles.title}>{copy.title}</ThemedText>
      <ThemedText style={styles.description}>{copy.description}</ThemedText>

      <View style={styles.actions}>
        {reason === 'PROFILE_ERROR' ? (
          <TouchableOpacity
            style={[styles.button, styles.retryButton]}
            onPress={refreshProfile}
            disabled={loadingProfile}
            activeOpacity={0.85}
          >
            {loadingProfile ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={18} color={colors.primary} />
                <ThemedText style={styles.retryButtonText}>
                  {t('errors.invalidSession.retry')}
                </ThemedText>
              </>
            )}
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={styles.button}
          onPress={() => void logout()}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.onPrimary} />
          <ThemedText style={styles.buttonText}>{t('errors.invalidSession.logout')}</ThemedText>
        </TouchableOpacity>
      </View>
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
      padding: 24,
      gap: 18,
    },
    iconWrap: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.error + '22',
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: '800',
      textAlign: 'center',
    },
    description: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
      maxWidth: 480,
      textAlign: 'center',
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 12,
      marginTop: 6,
    },
    button: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 22,
      paddingVertical: 13,
      borderRadius: 10,
    },
    buttonText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    retryButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary + '55',
    },
    retryButtonText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: '800',
    },
  });
