import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import { type AppColors, useAppColors } from '@/src/styles';

interface AuthErrorBannerProps {
  message: string;
  dismissLabel: string;
  onDismiss: () => void;
}

export function AuthErrorBanner({
  message,
  dismissLabel,
  onDismiss,
}: AuthErrorBannerProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <Ionicons name="alert-circle-outline" size={20} color={colors.error} />
      <ThemedText
        style={styles.message}
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
      >
        {message}
      </ThemedText>
      <TouchableOpacity
        style={styles.dismissButton}
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
      padding: 12,
      borderWidth: 1,
      borderColor: `${colors.error}66`,
      borderRadius: 8,
      backgroundColor: `${colors.error}12`,
    },
    message: {
      flex: 1,
      color: colors.error,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
    },
    dismissButton: {
      padding: 2,
    },
  });
