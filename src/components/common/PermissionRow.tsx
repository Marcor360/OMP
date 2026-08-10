import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { type AppTranslationKey, useOptionalI18n } from '@/src/i18n/index';
import { type AppColors, useAppColors } from '@/src/styles';
import { PermissionStatus } from '@/src/types/permissions.types';

interface PermissionRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
  status: PermissionStatus;
  onRequest: () => Promise<unknown>;
  onOpenSettings?: () => Promise<void>;
  loading?: boolean;
}

const STATUS_CONFIG: Record<
  PermissionStatus,
  { labelKey: AppTranslationKey; colorToken: keyof AppColors; icon: keyof typeof Ionicons.glyphMap }
> = {
  granted: {
    labelKey: 'permission.status.granted',
    colorToken: 'success',
    icon: 'checkmark-circle' as const,
  },
  denied: {
    labelKey: 'permission.status.denied',
    colorToken: 'error',
    icon: 'close-circle' as const,
  },
  undetermined: {
    labelKey: 'permission.status.undetermined',
    colorToken: 'warning',
    icon: 'help-circle' as const,
  },
  unavailable: {
    labelKey: 'permission.status.unavailable',
    colorToken: 'textDisabled',
    icon: 'remove-circle-outline' as const,
  },
};

/**
 * Fila de permiso del sistema para la pantalla de configuración.
 * Muestra ícono, nombre, descripción, estado actual y botón de acción.
 */
export function PermissionRow({
  icon,
  title,
  description,
  status,
  onRequest,
  onOpenSettings,
  loading = false,
}: PermissionRowProps) {
  const colors = useAppColors();
  const i18n = useOptionalI18n();
  const cfg = STATUS_CONFIG[status];
  const { colorToken } = cfg;
  const statusColor = colors[colorToken];

  const [requesting, setRequesting] = React.useState(false);

  const handlePress = async () => {
    if (requesting || loading) return;

    if (status === 'denied' && onOpenSettings) {
      // Si fue denegado, solo se puede cambiar en Configuración del SO
      await onOpenSettings();
      return;
    }

    if (status === 'undetermined') {
      setRequesting(true);
      try {
        await onRequest();
      } finally {
        setRequesting(false);
      }
    }
  };

  const isInteractive = status === 'undetermined' || status === 'denied';
  const btnLabel =
    status === 'denied'
      ? i18n?.t('common.permissionOpenSettings') ?? 'Abrir Ajustes'
      : status === 'granted'
        ? ''
        : i18n?.t('common.permissionAllow') ?? 'Permitir';
  const statusLabel = i18n?.t(cfg.labelKey) ?? cfg.labelKey;
  const accessibilityLabel = (i18n?.t('common.permissionA11yLabel') ?? '{action} permiso de {title}')
    .replace('{action}', btnLabel)
    .replace('{title}', title);

  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: `${colors.primary}15`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textBlock: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    description: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 16,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 3,
    },
    statusLabel: {
      fontSize: 11,
      fontWeight: '600',
    },
    actionBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 80,
    },
    actionBtnText: {
      fontSize: 12,
      fontWeight: '700',
    },
  });

  return (
    <View style={styles.row}>
      {/* Ícono del permiso */}
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={19} color={colors.primary} />
      </View>

      {/* Texto */}
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {description}
        </Text>
        <View style={styles.statusRow}>
          <Ionicons name={cfg.icon} size={12} color={statusColor} />
          <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Botón de acción */}
      {isInteractive && (
        <TouchableOpacity
          style={[
            styles.actionBtn,
            {
              backgroundColor:
                status === 'denied'
                  ? `${colors.warning}15`
                  : `${colors.primary}15`,
              borderColor:
                status === 'denied' ? colors.warning : colors.primary,
            },
          ]}
          onPress={handlePress}
          disabled={requesting || loading}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          {requesting ? (
            <ActivityIndicator
              size="small"
              color={status === 'denied' ? colors.warning : colors.primary}
            />
          ) : (
            <Text
              style={[
                styles.actionBtnText,
                {
                  color: status === 'denied' ? colors.warning : colors.primary,
                },
              ]}
            >
              {btnLabel}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}
