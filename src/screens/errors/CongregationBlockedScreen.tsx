import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/src/components/themed-text';
import { useAuth } from '@/src/context/auth-context';
import { useUser } from '@/src/context/user-context';
import { CongregationAccessState } from '@/src/types/congregation-access';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

interface CongregationBlockedScreenProps {
  access: CongregationAccessState;
}

export function CongregationBlockedScreen({ access }: CongregationBlockedScreenProps) {
  const { logout } = useAuth();
  const { refreshProfile } = useUser();
  const [now, setNow] = useState(() => Date.now());
  const colors = useAppColors();
  const styles = createStyles(colors);
  const blockedUntilMs = useMemo(() => {
    if (!access.blockedUntil) return null;
    const parsed = new Date(access.blockedUntil).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }, [access.blockedUntil]);
  const remainingMs = blockedUntilMs ? Math.max(0, blockedUntilMs - now) : null;

  useEffect(() => {
    if (!blockedUntilMs) return undefined;

    const interval = setInterval(() => {
      const nextNow = Date.now();
      setNow(nextNow);

      if (nextNow >= blockedUntilMs) {
        refreshProfile();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [blockedUntilMs, refreshProfile]);

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="business-outline" size={46} color={colors.error} />
      </View>

      <ThemedText style={styles.title}>Congregacion desactivada</ThemedText>

      <View style={styles.details}>
        <InfoLine label="Congregacion" value={access.congregationName} />
        <InfoLine label="ID en Firebase" value={access.firebaseName} />
        <InfoLine label="Motivo" value={access.reasonLabel} />
      </View>

      <ThemedText style={styles.description}>
        No se puede acceder a esta congregacion hasta que sea reactivada desde la
        administracion general.
      </ThemedText>

      {remainingMs !== null ? (
        <View style={styles.countdownCard}>
          <ThemedText style={styles.countdownLabel}>
            O bien, terminando el tiempo de:
          </ThemedText>
          <ThemedText style={styles.countdownValue}>
            {formatRemainingTime(remainingMs)}
          </ThemedText>
        </View>
      ) : null}

      <TouchableOpacity style={styles.button} onPress={logout} activeOpacity={0.85}>
        <Ionicons name="log-out-outline" size={18} color={colors.onPrimary} />
        <ThemedText style={styles.buttonText}>Cerrar sesion</ThemedText>
      </TouchableOpacity>
    </View>
  );
}

function formatRemainingTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((item) => item.toString().padStart(2, '0'))
    .join(':');
}

function InfoLine({ label, value }: { label: string; value: string }) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.infoLine}>
      <ThemedText style={styles.infoLabel}>{label}</ThemedText>
      <ThemedText style={styles.infoValue}>{value}</ThemedText>
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
      padding: 24,
      gap: 18,
    },
    iconWrap: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.error + '22',
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: '800',
      textAlign: 'center',
    },
    details: {
      width: '100%',
      maxWidth: 520,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surface,
      padding: 16,
      gap: 12,
    },
    infoLine: {
      gap: 4,
    },
    infoLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    infoValue: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    description: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
      maxWidth: 520,
      textAlign: 'center',
    },
    countdownCard: {
      width: '100%',
      maxWidth: 520,
      borderWidth: 1,
      borderColor: colors.primary + '55',
      borderRadius: 12,
      backgroundColor: colors.primary + '12',
      paddingVertical: 16,
      paddingHorizontal: 18,
      alignItems: 'center',
      gap: 8,
    },
    countdownLabel: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
      textAlign: 'center',
    },
    countdownValue: {
      color: colors.textPrimary,
      fontSize: 34,
      fontWeight: '900',
      letterSpacing: 0,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 22,
      paddingVertical: 13,
      borderRadius: 10,
    },
    buttonText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
  });
