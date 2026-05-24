import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ErrorState } from '@/src/components/common/ErrorState';
import { LoadingState } from '@/src/components/common/LoadingState';
import { PageHeader } from '@/src/components/layout/PageHeader';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { PreachingReportModal } from '@/src/components/preaching/PreachingReportModal';
import { ThemedText } from '@/src/components/themed-text';
import { useUser } from '@/src/context/user-context';
import { usePreachingReport } from '@/src/hooks/usePreachingReport';
import { getCongregationDisplayName } from '@/src/services/congregations/congregations-service';
import {
  getCurrentMonthId,
  getMonthName,
} from '@/src/services/preaching-report.service';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';
import { isPioneer, isPreachingManager } from '@/src/types/user';
import { formatFirestoreError } from '@/src/utils/errors/errors';
import { canManageTerritories } from '@/src/utils/permissions/permissions';

export function PreachingScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { appUser, congregationId, loadingProfile, profileError } = useUser();
  const [congregationName, setCongregationName] = useState('Sin congregacion');
  const [modalVisible, setModalVisible] = useState(false);
  const monthId = getCurrentMonthId();

  const {
    report,
    loading,
    saving,
    error,
    submit,
    refresh,
  } = usePreachingReport({
    user: appUser,
    congregationName,
    monthId,
  });

  useEffect(() => {
    if (!congregationId) {
      setCongregationName('Sin congregacion');
      return;
    }

    let cancelled = false;

    getCongregationDisplayName(congregationId, { forceServer: true })
      .then((name) => {
        if (!cancelled) setCongregationName(name);
      })
      .catch(() => {
        if (!cancelled) setCongregationName(congregationId);
      });

    return () => {
      cancelled = true;
    };
  }, [congregationId]);

  const handleSubmit = useCallback(
    async (...args: Parameters<typeof submit>) => {
      try {
        await submit(...args);
        setModalVisible(false);
        Alert.alert('Informe enviado', 'Tu informe mensual fue guardado correctamente.');
      } catch (requestError) {
        Alert.alert('Error', formatFirestoreError(requestError));
      }
    },
    [submit]
  );

  if (loadingProfile || loading) return <LoadingState message="Cargando predicacion..." />;

  if (!appUser || !appUser.isActive || !congregationId) {
    return (
      <ErrorState
        message={profileError ?? 'Necesitas una cuenta activa con congregacion para enviar informes.'}
      />
    );
  }

  const userIsPioneer = isPioneer(appUser);
  const userIsPreachingManager = isPreachingManager(appUser);
  const userCanManageTerritories = canManageTerritories(appUser);

  return (
    <ScreenContainer refreshing={loading} onRefresh={refresh}>
      <PageHeader title="Predicacion" />

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="document-text-outline" size={26} color={colors.primary} />
        </View>
        <View style={styles.heroText}>
          <ThemedText style={styles.heroTitle}>Informe mensual</ThemedText>
          <ThemedText style={styles.heroSubtitle}>{getMonthName(monthId)}</ThemedText>
        </View>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <ThemedText style={styles.statusTitle}>
            {report ? 'Informe enviado' : 'Informe pendiente'}
          </ThemedText>
          <Ionicons
            name={report ? 'checkmark-circle-outline' : 'time-outline'}
            size={22}
            color={report ? colors.success : colors.warning}
          />
        </View>
        <ThemedText style={styles.statusText}>
          {report
            ? 'Puedes editar y reemplazar tu informe del mes actual.'
            : 'Todos los publicadores activos pueden enviar su informe mensual.'}
        </ThemedText>
      </View>

      <View style={styles.infoGrid}>
        <InfoPill icon="home-outline" label="Congregacion" value={congregationName} />
        <InfoPill
          icon="time-outline"
          label="Horas"
          value={userIsPioneer ? 'Habilitadas' : 'Solo precursores'}
        />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="send-outline" size={18} color={colors.onPrimary} />
        <ThemedText style={styles.primaryButtonText}>
          {report ? 'Editar informe' : 'Enviar informe mensual'}
        </ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.push('/(protected)/territories' as any)}
        activeOpacity={0.85}
      >
        <Ionicons name="map-outline" size={18} color={colors.primary} />
        <ThemedText style={styles.secondaryButtonText}>Territorios</ThemedText>
      </TouchableOpacity>

      {userIsPreachingManager ? (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/(protected)/preaching/manager' as any)}
          activeOpacity={0.85}
        >
          <Ionicons name="stats-chart-outline" size={18} color={colors.primary} />
          <ThemedText style={styles.secondaryButtonText}>Panel de informes</ThemedText>
        </TouchableOpacity>
      ) : null}

      {userCanManageTerritories ? (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/(protected)/territories/manage' as any)}
          activeOpacity={0.85}
        >
          <Ionicons name="settings-outline" size={18} color={colors.primary} />
          <ThemedText style={styles.secondaryButtonText}>Administrar territorios</ThemedText>
        </TouchableOpacity>
      ) : null}

      <PreachingReportModal
        visible={modalVisible}
        user={appUser}
        monthId={monthId}
        congregationName={congregationName}
        existingReport={report}
        saving={saving}
        onClose={() => setModalVisible(false)}
        onSubmit={handleSubmit}
      />
    </ScreenContainer>
  );
}

function InfoPill({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.infoPill}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <View style={styles.infoPillText}>
        <ThemedText style={styles.infoLabel}>{label}</ThemedText>
        <ThemedText style={styles.infoValue} numberOfLines={1}>{value}</ThemedText>
      </View>
    </View>
  );
}

const createStyles = (colors: AppColorSet) =>
  StyleSheet.create({
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    heroIcon: {
      width: 52,
      height: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary + '18',
    },
    heroText: {
      flex: 1,
      minWidth: 0,
    },
    heroTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    heroSubtitle: {
      fontSize: 13,
      color: colors.textMuted,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    statusCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      gap: 8,
      marginBottom: 12,
    },
    statusHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    statusTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    statusText: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 19,
    },
    infoGrid: {
      gap: 10,
      marginBottom: 12,
    },
    infoPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
    },
    infoPillText: {
      flex: 1,
      minWidth: 0,
    },
    infoLabel: {
      fontSize: 11,
      color: colors.textMuted,
      fontWeight: '700',
    },
    infoValue: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    errorBox: {
      backgroundColor: colors.error + '18',
      borderWidth: 1,
      borderColor: colors.error + '44',
      borderRadius: 10,
      padding: 12,
      marginBottom: 12,
    },
    errorText: {
      color: colors.error,
      fontSize: 13,
      fontWeight: '600',
    },
    primaryButton: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 12,
      marginBottom: 10,
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    secondaryButton: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary + '55',
      borderRadius: 12,
      marginBottom: 10,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: '800',
    },
  });
