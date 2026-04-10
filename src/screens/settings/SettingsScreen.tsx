import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { RoleGuard } from '@/src/components/common/RoleGuard';
import { ScreenContainer } from '@/src/components/layout/ScreenContainer';
import { ThemedText } from '@/src/components/themed-text';
import { useAppTheme } from '@/src/context/theme-context';
import { useUser } from '@/src/context/user-context';
import { ROLE_LABELS } from '@/src/types/user';
import { type AppColors, useAppColors } from '@/src/styles';

export function SettingsScreen() {
  const { appUser } = useUser();
  const { isDarkMode, toggleThemeMode } = useAppTheme();
  const colors = useAppColors();
  const styles = createStyles(colors);

  const handleToggleTheme = () => {
    void toggleThemeMode();
  };

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
    rightElement,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value?: string;
    showArrow?: boolean;
    onPress?: () => void;
    rightElement?: React.ReactNode;
  }) {
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={onPress}
        disabled={!onPress && !showArrow}
        activeOpacity={0.7}
      >
        <Ionicons name={icon} size={18} color={colors.primary} />
        <ThemedText style={styles.rowLabel}>{label}</ThemedText>
        <View style={styles.rowRight}>
          {value ? (
            <ThemedText style={styles.rowValue} numberOfLines={1}>
              {value}
            </ThemedText>
          ) : null}
          {rightElement}
          {showArrow ? <Ionicons name="chevron-forward" size={16} color={colors.textDisabled} /> : null}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Cuenta">
          <SettingRow icon="person-circle-outline" label="Nombre" value={appUser?.displayName ?? '--'} />
          <SettingRow icon="mail-outline" label="Correo" value={appUser?.email ?? '--'} />
          <SettingRow
            icon="shield-checkmark-outline"
            label="Rol"
            value={appUser ? ROLE_LABELS[appUser.role] : '--'}
          />
        </Section>

        <RoleGuard requiredRole="admin">
          <Section title="Administracion">
            <SettingRow icon="people-outline" label="Gestion de usuarios" value="Ver usuarios" showArrow />
            <SettingRow icon="stats-chart-outline" label="Reportes del sistema" value="Proximamente" />
            <SettingRow icon="server-outline" label="Configuracion de Firebase" value="ormeprassig-public" />
          </Section>
        </RoleGuard>

        <RoleGuard allowedRoles={['admin', 'supervisor']}>
          <Section title="Gestion">
            <SettingRow icon="calendar-outline" label="Reuniones activas" value="Ver calendario" showArrow />
            <SettingRow
              icon="checkmark-done-outline"
              label="Asignaciones pendientes"
              value="Ver asignaciones"
              showArrow
            />
          </Section>
        </RoleGuard>

        <Section title="Aplicacion">
          <SettingRow
            icon="moon-outline"
            label="Modo oscuro"
            value={isDarkMode ? 'Activo' : 'Inactivo'}
            onPress={handleToggleTheme}
            rightElement={
              <Switch
                value={isDarkMode}
                onValueChange={handleToggleTheme}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={isDarkMode ? colors.primary : colors.surfaceRaised}
              />
            }
          />
          <SettingRow icon="language-outline" label="Idioma" value="Espanol" />
          <SettingRow icon="information-circle-outline" label="Version" value="1.0.0" />
        </Section>

        <Section title="Legal">
          <SettingRow icon="document-text-outline" label="Terminos de uso" showArrow />
          <SettingRow icon="lock-closed-outline" label="Politica de privacidad" showArrow />
        </Section>
      </ScrollView>
    </ScreenContainer>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    content: { padding: 16, gap: 20, paddingBottom: 32 },
    section: { gap: 8 },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      paddingHorizontal: 4,
    },
    sectionCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowLabel: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      color: colors.textPrimary,
    },
    rowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: '45%',
    },
    rowValue: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'right',
    },
  });
