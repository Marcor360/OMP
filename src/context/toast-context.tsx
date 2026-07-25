import { Ionicons } from '@expo/vector-icons';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/src/components/themed-text';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

type ToastType = 'success' | 'error' | 'info';

interface ToastState {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const TOAST_DURATION_MS = 3000;
const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors, insets.bottom);
  const progress = useRef(new Animated.Value(1)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'success') => {
      clearHideTimer();
      progress.stopAnimation();
      progress.setValue(1);
      setToast({ id: Date.now(), message, type });

      Animated.timing(progress, {
        toValue: 0,
        duration: TOAST_DURATION_MS,
        useNativeDriver: false,
      }).start();

      hideTimerRef.current = setTimeout(() => {
        setToast(null);
      }, TOAST_DURATION_MS);
    },
    [clearHideTimer, progress]
  );

  useEffect(() => {
    return () => {
      clearHideTimer();
      progress.stopAnimation();
    };
  }, [clearHideTimer, progress]);

  const value = useMemo(() => ({ showToast }), [showToast]);
  const accent = toast?.type === 'error' ? colors.error : toast?.type === 'info' ? colors.info : colors.success;
  const icon = toast?.type === 'error' ? 'alert-circle-outline' : 'checkmark-circle-outline';

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="none" style={styles.toastLayer}>
        {toast ? (
          <View
            style={[styles.toast, { borderColor: accent + '66' }]}
            accessibilityRole="alert"
            accessibilityLiveRegion={toast.type === 'error' ? 'assertive' : 'polite'}
            accessibilityLabel={toast.message}
          >
            <View style={styles.toastBody}>
              <Ionicons name={icon} size={18} color={accent} />
              <ThemedText style={styles.toastMessage}>{toast.message}</ThemedText>
            </View>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: accent,
                    width: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
          </View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast debe usarse dentro de ToastProvider');
  }

  return context;
}

const createStyles = (colors: AppColorSet, bottomInset: number) =>
  StyleSheet.create({
    toastLayer: {
      position: Platform.OS === 'web' ? 'fixed' as never : 'absolute',
      left: 0,
      right: 0,
      bottom: bottomInset + 12,
      zIndex: 999,
      alignItems: 'center',
      paddingHorizontal: 16,
    },
    toast: {
      width: '100%',
      maxWidth: 420,
      overflow: 'hidden',
      borderRadius: 8,
      borderWidth: 1,
      backgroundColor: colors.surface,
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    toastBody: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    toastMessage: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    progressTrack: {
      height: 3,
      backgroundColor: colors.surfaceRaised,
    },
    progressFill: {
      height: 3,
    },
  });
