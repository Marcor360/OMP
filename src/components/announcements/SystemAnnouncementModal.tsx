import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { type EdgeInsets, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/src/components/themed-text';
import { useI18n } from '@/src/i18n';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import type {
  SystemAnnouncement,
  SystemAnnouncementType,
} from '@/src/types/system-announcement';

interface SystemAnnouncementModalProps {
  announcement: SystemAnnouncement | null;
  visible: boolean;
  onClose: () => void;
}

const typeConfig: Record<
  SystemAnnouncementType,
  {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    colorKey: keyof Pick<AppColorSet, 'info' | 'success' | 'warning' | 'error'>;
    backgroundKey: keyof Pick<
      AppColorSet,
      'infoLight' | 'successLight' | 'warningLight' | 'errorLight'
    >;
  }
> = {
  info: {
    icon: 'information-circle-outline',
    label: 'info',
    colorKey: 'info',
    backgroundKey: 'infoLight',
  },
  success: {
    icon: 'checkmark-circle-outline',
    label: 'update',
    colorKey: 'success',
    backgroundKey: 'successLight',
  },
  warning: {
    icon: 'warning-outline',
    label: 'warning',
    colorKey: 'warning',
    backgroundKey: 'warningLight',
  },
  maintenance: {
    icon: 'construct-outline',
    label: 'maintenance',
    colorKey: 'error',
    backgroundKey: 'errorLight',
  },
};

export function SystemAnnouncementModal({
  announcement,
  visible,
  onClose,
}: SystemAnnouncementModalProps) {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const cardHeight = Math.min(Math.max(320, height - insets.top - insets.bottom - 48), 560);
  const { t } = useI18n();
  const styles = useMemo(
    () => createStyles(colors, insets, cardHeight),
    [cardHeight, colors, insets]
  );

  if (!announcement) return null;

  const config = typeConfig[announcement.type];
  const accentColor = colors[config.colorKey];
  const accentBackground = colors[config.backgroundKey];

  return (
    <Modal
      animationType="fade"
      navigationBarTranslucent
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: accentBackground,
                  borderColor: accentColor,
                },
              ]}
            >
              <Ionicons name={config.icon} size={28} color={accentColor} />
            </View>
            <View style={styles.headerText}>
              <ThemedText style={[styles.kicker, { color: accentColor }]}>
                {t(`system.announcements.${config.label}` as any)}
              </ThemedText>
              <ThemedText style={styles.title}>{announcement.title}</ThemedText>
            </View>
          </View>

          <ScrollView
            bounces={false}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <ThemedText style={styles.message}>{announcement.message}</ThemedText>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('system.announcements.dismissAccessibility')}
              onPress={onClose}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: accentColor },
                pressed && styles.buttonPressed,
              ]}
            >
              <ThemedText style={styles.buttonText}>{t('system.announcements.understood')}</ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: AppColorSet, insets: EdgeInsets, cardHeight: number) =>
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
      maxWidth: 520,
      maxHeight: cardHeight,
      overflow: 'hidden',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
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
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.backgroundMedium,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
    },
    kicker: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0,
      marginBottom: 4,
      textTransform: 'uppercase',
    },
    title: {
      color: colors.textPrimary,
      fontSize: 21,
      fontWeight: '800',
      lineHeight: 27,
    },
    content: {
      padding: 20,
      paddingBottom: 22,
    },
    message: {
      color: colors.textSecondary,
      fontSize: 16,
      lineHeight: 24,
    },
    footer: {
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: Math.max(insets.bottom, 8) + 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    button: {
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      paddingHorizontal: 18,
    },
    buttonPressed: {
      opacity: 0.86,
    },
    buttonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '800',
      lineHeight: 22,
    },
  });
