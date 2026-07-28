import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { type EdgeInsets, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/src/components/themed-text';
import { useI18n } from '@/src/i18n';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

interface InactivityWarningModalProps {
  visible: boolean;
  secondsLeft: number;
  onExtendSession: () => void;
  onLogout: () => void;
}

export function InactivityWarningModal({
  visible,
  secondsLeft,
  onExtendSession,
  onLogout,
}: InactivityWarningModalProps) {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(colors, insets), [colors, insets]);

  return (
    <Modal
      animationType="fade"
      navigationBarTranslucent
      onRequestClose={onExtendSession}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="time-outline" size={28} color={colors.warning} />
            </View>
            <View style={styles.headerText}>
              <ThemedText style={styles.title}>{t('session.inactivity.title')}</ThemedText>
              <ThemedText style={styles.countdown}>
                {t('session.inactivity.countdown', { seconds: Math.max(0, secondsLeft) })}
              </ThemedText>
            </View>
          </View>

          <ThemedText style={styles.message}>{t('session.inactivity.description')}</ThemedText>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('session.inactivity.logout')}
              onPress={onLogout}
              style={({ pressed }) => [
                styles.button,
                styles.secondaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <ThemedText style={styles.secondaryButtonText}>
                {t('session.inactivity.logout')}
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('session.inactivity.keepConnected')}
              onPress={onExtendSession}
              style={({ pressed }) => [
                styles.button,
                styles.primaryButton,
                { backgroundColor: colors.primary },
                pressed && styles.buttonPressed,
              ]}
            >
              <ThemedText style={styles.primaryButtonText}>
                {t('session.inactivity.keepConnected')}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: AppColorSet, insets: EdgeInsets) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
      paddingTop: Math.max(insets.top + 12, 18),
      paddingBottom: Math.max(insets.bottom + 12, 18),
      backgroundColor: colors.overlay,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 20,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.22,
      shadowRadius: 28,
      elevation: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 14,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.warning,
      backgroundColor: `${colors.warning}18`,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 23,
    },
    countdown: {
      marginTop: 2,
      color: colors.warning,
      fontSize: 15,
      fontWeight: '700',
    },
    message: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 20,
    },
    footer: {
      flexDirection: 'row',
      gap: 10,
    },
    button: {
      flex: 1,
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      paddingHorizontal: 14,
    },
    primaryButton: {},
    secondaryButton: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundMedium,
    },
    buttonPressed: {
      opacity: 0.86,
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontSize: 14,
      fontWeight: '800',
    },
    secondaryButtonText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '700',
    },
  });
