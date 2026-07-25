import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { type AppColors, useAppColors } from '@/src/styles';

interface ActionErrorBannerProps {
  message: string;
  retryLabel?: string;
  dismissLabel: string;
  onRetry?: () => void;
  onDismiss: () => void;
}

export function ActionErrorBanner({
  message,
  retryLabel,
  dismissLabel,
  onRetry,
  onDismiss,
}: ActionErrorBannerProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View
      style={styles.container}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <Ionicons name="alert-circle-outline" size={20} color={colors.error} />
      <View style={styles.content}>
        <Text style={styles.message}>{message}</Text>
        {onRetry && retryLabel ? (
          <TouchableOpacity
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={retryLabel}
          >
            <Text style={styles.retry}>{retryLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <TouchableOpacity
        style={styles.dismiss}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={dismissLabel}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      >
        <Ionicons name="close" size={20} color={colors.error} />
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      borderWidth: 1,
      borderColor: `${colors.error}55`,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.errorLight,
    },
    content: {
      flex: 1,
      gap: 8,
    },
    message: {
      color: colors.error,
      fontSize: 13,
      lineHeight: 18,
    },
    retry: {
      color: colors.error,
      fontSize: 13,
      fontWeight: '800',
    },
    dismiss: {
      padding: 2,
    },
  });
