import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  type KeyboardAvoidingViewProps,
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

interface ScreenContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  padded?: boolean;
  safeAreaEdges?: Edge[];
  keyboardAware?: boolean;
  keyboardVerticalOffset?: number;
}

/**
 * Wrapper estándar para todas las pantallas.
 * Maneja SafeArea, scroll opcional, refresh control y padding.
 */
export function ScreenContainer({
  children,
  scrollable = true,
  refreshing = false,
  onRefresh,
  style,
  contentStyle,
  padded = true,
  safeAreaEdges = ['top', 'bottom'],
  keyboardAware = true,
  keyboardVerticalOffset = 0,
}: ScreenContainerProps) {
  const colors = useAppColors();
  const styles = createStyles(colors);
  const keyboardBehavior: KeyboardAvoidingViewProps['behavior'] =
    Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined;

  const inner = (
    <View style={[styles.inner, padded && styles.padded, contentStyle]}>
      {children}
    </View>
  );

  const content = scrollable ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
    >
      {inner}
    </ScrollView>
  ) : (
    inner
  );

  return (
    <SafeAreaView style={[styles.safe, style]} edges={safeAreaEdges}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        enabled={keyboardAware}
        behavior={keyboardBehavior}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.backgroundDark,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
    },
    keyboardContainer: {
      flex: 1,
    },
    inner: {
      flex: 1,
    },
    padded: {
      padding: 16,
    },
  });
