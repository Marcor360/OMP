import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { RoleGuard } from '@/src/components/common/RoleGuard';
import { ThemedText } from '@/src/components/themed-text';
import { AppColors } from '@/src/constants/app-colors';
import { useUser } from '@/src/context/user-context';
import { ROLE_LABELS } from '@/src/types/user';

export function SettingsScreen() {
  const { appUser } = useUser();

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Account */}
        <Section title="Cuenta">
          <SettingRow
            icon="person-circle-outline"
            label="Nombre"
            value={appUser?.displayName ?? '—'}
          />
          <SettingRow
            icon="mail-outline"
            label="Correo"
            value={appUser?.email ?? '—'}
          />
          <SettingRow
            icon="shield-checkmark-outline"
            label="Rol"
            value={appUser ? ROLE_LABELS[appUser.role] : '—'}
          />
        </Section>

        {/* Admin settings */}
        <RoleGuard requiredRole="admin">
          <Section title="Administración">
            <SettingRow
              icon="people-outline"
              label="Gestión de usuarios"
              value="Ver usuarios"
              showArrow
            />
            <SettingRow
              icon="stats-chart-outline"
              label="Reportes del sistema"
              value="Próximamente"
            />
            <SettingRow
              icon="server-outline"
              label="Configuración de Firebase"
              value="ormeprassig-public"
            />
          </Section>
        </RoleGuard>

        {/* Supervisor settings */}
        <RoleGuard allowedRoles={['admin', 'supervisor']}>
          <Section title="Gestión">
            <SettingRow
              icon="calendar-outline"
              label="Reuniones activas"
              value="Ver calendario"
              showArrow
            />
            <SettingRow
              icon="checkmark-done-outline"
              label="Asignaciones pendientes"
              value="Ver asignaciones"
              showArrow
            />
          </Section>
        </RoleGuard>

        {/* App */}
        <Section title="Aplicación">
          <SettingRow icon="moon-outline" label="Tema" value="Oscuro (predeterminado)" />
          <SettingRow icon="language-outline" label="Idioma" value="Español" />
          <SettingRow icon="information-circle-outline" label="Versión" value="1.0.0" />
        </Section>

        {/* Legal */}
        <Section title="Legal">
          <SettingRow icon="document-text-outline" label="Términos de uso" showArrow />
          <SettingRow icon="lock-closed-outline" label="Política de privacidad" showArrow />
        </Section>
      </ScrollView>
    </ScreenContainer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function SettingRow({
  icon,
  label,
  value,
  showArrow = false,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  showArrow?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress && !showArrow}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={18} color={AppColors.primary} />
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      <View style={styles.rowRight}>
        {value ? (
          <ThemedText style={styles.rowValue} numberOfLines={1}>
            {value}
          </ThemedText>
        ) : null}
        {showArrow ? (
          <Ionicons name="chevron-forward" size={16} color={AppColors.textDisabled} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20, paddingBottom: 32 },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: AppColors.textPrimary,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '45%',
  },
  rowValue: {
    fontSize: 13,
    color: AppColors.textMuted,
    textAlign: 'right',
  },
});
