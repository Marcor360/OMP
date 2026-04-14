import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/src/components/themed-text';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

export function NotFoundScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <ThemedText style={styles.code}>404</ThemedText>
      <View style={styles.iconWrap}>
        <Ionicons name="search-outline" size={40} color={colors.textDisabled} />
      </View>
      <ThemedText style={styles.title}>Pagina no encontrada</ThemedText>
      <ThemedText style={styles.description}>La ruta que buscas no existe o fue movida.</ThemedText>
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

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundDark,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
      gap: 12,
    },
    code: {
      fontSize: 72,
      fontWeight: '900',
      color: colors.border,
      lineHeight: 80,
    },
    iconWrap: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    description: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
    },
    buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });
