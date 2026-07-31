import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/src/components/themed-text';
import { useAppLock } from '@/src/context/app-lock-context';
import { useAuth } from '@/src/context/auth-context';
import { useI18n } from '@/src/i18n';
import {
  authenticateLocally,
  getBiometricAvailability,
} from '@/src/services/security/biometric-service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

type ScreenState = 'checking' | 'prompting' | 'error' | 'unsupported';

export function BiometricLockScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors, insets.top, insets.bottom);
  const { t } = useI18n();
  const { unlock } = useAppLock();
  const { logout } = useAuth();

  const [state, setState] = useState<ScreenState>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const attemptInFlightRef = useRef(false);

  const attemptUnlock = async () => {
    if (attemptInFlightRef.current) return;
    attemptInFlightRef.current = true;
    setState('prompting');
    setErrorMessage(null);

    try {
      const availability = await getBiometricAvailability();
      if (!availability.hasHardware && !availability.isEnrolled) {
        setState('unsupported');
        return;
      }

      const result = await authenticateLocally({
        promptMessage: t('session.lock.promptMessage'),
        cancelLabel: t('session.lock.cancelLabel'),
      });

      if (result.success) {
        unlock();
        return;
      }

      if (result.reason === 'unavailable') {
        setState('unsupported');
        return;
      }

      const messageKey =
        result.reason === 'lockout'
          ? 'session.lock.errorLockout'
          : result.reason === 'canceled'
            ? 'session.lock.errorCanceled'
            : 'session.lock.errorFailed';
      setErrorMessage(t(messageKey));
      setState('error');
    } finally {
      attemptInFlightRef.current = false;
    }
  };

  useEffect(() => {
    void attemptUnlock();
    // Solo se intenta automaticamente una vez al montar esta pantalla (cada
    // bloqueo nuevo remonta el componente). Reintentos posteriores son manuales.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  const isUnsupported = state === 'unsupported';
  const isChecking = state === 'checking' || state === 'prompting';

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.brandWrap}>
          <View style={styles.brandBadge}>
            <ThemedText style={styles.brandBadgeText}>OMP</ThemedText>
          </View>
        </View>

        <View style={styles.iconWrap}>
          <Ionicons
            name={isUnsupported ? 'alert-circle-outline' : 'lock-closed-outline'}
            size={40}
            color={isUnsupported ? colors.error : colors.primary}
          />
        </View>

        <ThemedText style={styles.title}>
          {isUnsupported ? t('session.lock.unsupportedTitle') : t('session.lock.title')}
        </ThemedText>
        <ThemedText style={styles.description}>
          {isUnsupported
            ? t('session.lock.unsupportedDescription')
            : t('session.lock.description')}
        </ThemedText>

        {errorMessage ? (
          <ThemedText style={styles.errorText} accessibilityLiveRegion="polite">
            {errorMessage}
          </ThemedText>
        ) : null}

        {isChecking ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
        ) : null}

        <View style={styles.actions}>
          {!isUnsupported ? (
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={() => void attemptUnlock()}
              disabled={isChecking}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={
                state === 'error' ? t('session.lock.retryButton') : t('session.lock.unlockButton')
              }
            >
              <ThemedText style={styles.primaryButtonText}>
                {state === 'error' ? t('session.lock.retryButton') : t('session.lock.unlockButton')}
              </ThemedText>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => void handleLogout()}
            disabled={loggingOut}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('session.lock.logoutButton')}
          >
            {loggingOut ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <ThemedText style={styles.secondaryButtonText}>
                {t('session.lock.logoutButton')}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: AppColorSet, topInset: number, bottomInset: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundLight,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: Math.max(topInset, 24),
      paddingBottom: Math.max(bottomInset, 24),
      paddingHorizontal: 24,
    },
    content: {
      width: '100%',
      maxWidth: 380,
      alignItems: 'center',
      gap: 6,
    },
    brandWrap: {
      marginBottom: 20,
    },
    brandBadge: {
      width: 64,
      height: 64,
      borderRadius: 18,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandBadgeText: {
      color: colors.onPrimary,
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: 0.5,
    },
    iconWrap: {
      width: 76,
      height: 76,
      borderRadius: 38,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    description: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
      marginTop: 4,
      marginBottom: 8,
    },
    errorText: {
      fontSize: 13,
      color: colors.error,
      textAlign: 'center',
      fontWeight: '600',
      marginBottom: 8,
    },
    spinner: {
      marginBottom: 8,
    },
    actions: {
      width: '100%',
      gap: 10,
      marginTop: 16,
    },
    button: {
      minHeight: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    secondaryButton: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundMedium,
    },
    secondaryButtonText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '700',
    },
  });
