/**
 * Tarjeta del dashboard para el Módulo: Contador de Horas de Predicación.
 *
 * Versión autónoma: lee AsyncStorage directamente, sin necesitar FieldServiceProvider.
 * Esto permite usarla en el dashboard principal sin modificar el layout protegido.
 *
 * - Muestra solo el total del mes actual
 * - Toda la tarjeta es clickeable (navega al módulo completo)
 * - Se refresca al montarse y cuando la app vuelve a primer plano
 * - Sin Firebase. Sin red.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState, AppStateStatus, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAppColors } from '@/src/styles';
import {
  formatMinutes,
  formatMonthHeader,
  getCurrentMonthSummary,
} from '@/src/modules/field-service/utils/field-service-dates';
import { loadStore } from '@/src/modules/field-service/services/field-service-storage';
import type { MonthSummary } from '@/src/modules/field-service/types/field-service.types';

/**
 * Tarjeta wrapper: en web devuelve null, en iOS/Android monta la tarjeta nativa.
 * Se divide en dos componentes para respetar las reglas de hooks (no condicionales).
 */
export function FieldServiceDashboardCard() {
  if (Platform.OS === 'web') return null;
  return <FieldServiceDashboardCardNative />;
}

/** Implementación de la tarjeta — solo se monta en iOS/Android */
function FieldServiceDashboardCardNative() {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const now = new Date();
  const [monthSummary, setMonthSummary] = useState<MonthSummary>({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    totalMinutes: 0,
    daysWithEntries: 0,
    entries: [],
  });
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const { store } = await loadStore();
      const summary = getCurrentMonthSummary(store);
      setMonthSummary(summary);
    } catch {
      // Fallo silencioso — muestra 0
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar al montar
  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Recargar cuando la app vuelve a primer plano (por si el usuario registró horas)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        void loadData();
      }
    });
    return () => sub.remove();
  }, [loadData]);

  const monthLabel = formatMonthHeader(monthSummary.year, monthSummary.month);

  const handlePress = () => {
    router.push('/(protected)/field-service' as any);
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Contador de horas de predicación"
    >
      {/* ── Ícono + título ── */}
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Ionicons name="hourglass-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.cardTitle}>Predicación</Text>
          <Text style={styles.cardSubtitle}>{monthLabel}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>

      {/* ── Total del mes ── */}
      <View style={styles.totalRow}>
        {loading ? (
          <Text style={styles.totalValue}>—</Text>
        ) : (
          <>
            <Text style={styles.totalValue}>
              {formatMinutes(monthSummary.totalMinutes)}
            </Text>
            {monthSummary.daysWithEntries > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
                <Text style={[styles.badgeText, { color: colors.primary }]}>
                  {monthSummary.daysWithEntries} día{monthSummary.daysWithEntries !== 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* ── Barra de progreso visual (decorativa, escala a 40h/mes → 2400 min) ── */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: colors.primary,
              width: `${Math.min(100, (monthSummary.totalMinutes / 2400) * 100)}%`,
            },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (colors: ReturnType<typeof useAppColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 12,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: {
      flex: 1,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    cardSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 1,
      textTransform: 'capitalize',
    },
    totalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    totalValue: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '700',
    },
    progressTrack: {
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: 4,
      borderRadius: 2,
      minWidth: 4,
    },
  });
