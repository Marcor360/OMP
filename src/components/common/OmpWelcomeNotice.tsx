import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import { ThemedView } from '@/src/components/themed-view';
import { useI18n } from '@/src/i18n/index';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

const WELCOME_NOTICE_DISMISSED_KEY = 'omp_welcome_notice_dismissed_v1';

const PARAGRAPH_KEYS = [
  'dashboard.welcomeNotice.paragraph1',
  'dashboard.welcomeNotice.paragraph2',
  'dashboard.welcomeNotice.paragraph3',
  'dashboard.welcomeNotice.paragraph4',
  'dashboard.welcomeNotice.paragraph5',
] as const;

export function OmpWelcomeNotice() {
  const colors = useAppColors();
  const { t } = useI18n();
  const { height, width } = useWindowDimensions();
  const isCompact = width < 520;
  const cardMaxHeight = Math.max(360, height - 56);
  const styles = useMemo(
    () => createStyles(colors, isCompact, cardMaxHeight),
    [cardMaxHeight, colors, isCompact]
  );
  const [isVisible, setIsVisible] = useState(false);
  const [hasLoadedPreference, setHasLoadedPreference] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadPreference = async () => {
      try {
        const dismissed = await AsyncStorage.getItem(WELCOME_NOTICE_DISMISSED_KEY);
        if (isMounted) {
          setIsVisible(dismissed !== '1');
        }
      } catch {
        if (isMounted) {
          setIsVisible(true);
        }
      } finally {
        if (isMounted) {
          setHasLoadedPreference(true);
        }
      }
    };

    void loadPreference();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDismiss = useCallback(async () => {
    setIsVisible(false);

    try {
      await AsyncStorage.setItem(WELCOME_NOTICE_DISMISSED_KEY, '1');
    } catch {
      // If persistence fails, the notice can appear again on the next launch.
    }
  }, []);

  if (!hasLoadedPreference || !isVisible) {
    return null;
  }

  return (
    <Modal
      animationType="fade"
      navigationBarTranslucent
      onRequestClose={() => undefined}
      statusBarTranslucent
      transparent
      visible={isVisible}
    >
      <View style={styles.backdrop}>
        <ThemedView style={styles.card}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="sparkles-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.headerText}>
              <ThemedText style={styles.title}>{t('dashboard.welcomeNotice.title')}</ThemedText>
            </View>
          </View>

          <ScrollView
            bounces={false}
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
            style={styles.scroller}
          >
            {PARAGRAPH_KEYS.map((key) => (
              <ThemedText key={key} style={styles.paragraph}>
                {t(key)}
              </ThemedText>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <ThemedText style={styles.signature}>{t('dashboard.welcomeNotice.signature')}</ThemedText>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.welcomeNotice.dismissAccessibilityLabel')}
              activeOpacity={0.78}
              onPress={handleDismiss}
              style={styles.dismissButton}
            >
              <ThemedText style={styles.dismissButtonText}>
                {t('dashboard.welcomeNotice.dismiss')}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>
      </View>
    </Modal>
  );
}

const createStyles = (colors: AppColorSet, isCompact: boolean, cardMaxHeight: number) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: isCompact ? 14 : 24,
      paddingVertical: 28,
      backgroundColor: colors.overlay,
    },
    card: {
      width: '100%',
      maxWidth: 640,
      maxHeight: cardMaxHeight,
      overflow: 'hidden',
      alignSelf: 'center',
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      shadowColor: colors.overlay,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.24,
      shadowRadius: 22,
      elevation: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: isCompact ? 16 : 20,
      paddingTop: isCompact ? 16 : 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    iconContainer: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.infoLight,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      color: colors.textPrimary,
      fontSize: isCompact ? 18 : 20,
      fontWeight: '800',
      lineHeight: isCompact ? 23 : 26,
    },
    scroller: {
      flexGrow: 0,
    },
    body: {
      gap: 11,
      paddingHorizontal: isCompact ? 16 : 20,
      paddingVertical: 16,
    },
    paragraph: {
      color: colors.textSecondary,
      fontSize: isCompact ? 14 : 15,
      lineHeight: isCompact ? 21 : 23,
    },
    footer: {
      gap: 14,
      paddingHorizontal: isCompact ? 16 : 20,
      paddingTop: 16,
      paddingBottom: isCompact ? 16 : 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    signature: {
      color: colors.textPrimary,
      fontSize: isCompact ? 14 : 15,
      lineHeight: isCompact ? 21 : 22,
      fontWeight: '700',
    },
    dismissButton: {
      width: '100%',
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
    },
    dismissButtonText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '800',
      textAlign: 'center',
    },
  });
