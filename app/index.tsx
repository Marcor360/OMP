import React from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

import { ThemedText } from '@/src/components/themed-text';
import { useAppColors } from '@/src/styles';

// Prevenir auto-hide en web también
if (Platform.OS === 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

export default function Index() {
  const colors = useAppColors();

  // Este componente se muestra mientras app/_layout.tsx decide la navegación
  // El splash se oculta desde RootLayoutNav cuando appReady === true

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundDark }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    opacity: 0.7,
  },
});
