import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/src/components/themed-text';
import { AppColors } from '@/src/constants/app-colors';

export function NotFoundScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ThemedText style={styles.code}>404</ThemedText>
      <View style={styles.iconWrap}>
        <Ionicons name="search-outline" size={40} color={AppColors.textDisabled} />
      </View>
      <ThemedText style={styles.title}>Página no encontrada</ThemedText>
      <ThemedText style={styles.description}>
        La ruta que buscas no existe o fue movida.
      </ThemedText>
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace('/(protected)/(tabs)/' as any)}
        activeOpacity={0.8}
      >
        <Ionicons name="home-outline" size={18} color="#fff" />
        <ThemedText style={styles.buttonText}>Ir al inicio</ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.backgroundDark,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  code: {
    fontSize: 72,
    fontWeight: '900',
    color: AppColors.border,
    lineHeight: 80,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: AppColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  description: {
    fontSize: 14,
    color: AppColors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    backgroundColor: AppColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
