import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { ThemedText } from '@/src/components/themed-text';
import { type AppColors, useAppColors } from '@/src/styles';

const features = [
  'Usuarios',
  'Roles y permisos',
  'Reuniones',
  'Asignaciones',
  'Limpieza',
  'Predicación',
  'Territorios',
  'Informes',
  'Notificaciones',
  'Organigrama',
  'Pagos por congregación',
  'Configuración por congregación',
] as const;

const securityPoints = [
  'Autenticación de usuarios',
  'Aislamiento de datos por congregación',
  'Reglas de seguridad en el backend',
  'Validación de acciones sensibles en servidor (no solo en el cliente)',
] as const;

const technologyPoints = [
  'React Native + Expo',
  'Multiplataforma (web, Android, iOS)',
  'Firebase (Auth, Firestore, Cloud Functions)',
  'Pagos con Stripe',
] as const;

const plans = [
  'Hasta 80 usuarios — $70 MXN al mes',
  'Hasta 150 usuarios — $120 MXN al mes',
  'Hasta 250 usuarios — $200 MXN al mes',
] as const;

const planDescription =
  'OMP Suite funciona mediante una suscripción mensual por congregación. Los precios son: hasta 80 usuarios $70 MXN al mes, hasta 150 usuarios $120 MXN al mes y hasta 250 usuarios $200 MXN al mes. Estos precios ya incluyen el procesamiento de pago con Stripe. No se cobra por usuario individual dentro del límite de cada plan.';

const whyPaidText =
  'OMP Suite tiene un costo mensual porque depende de servicios digitales activos para funcionar de forma estable, segura y continua. El pago ayuda a cubrir infraestructura en la nube, base de datos, autenticación de usuarios, notificaciones, hosting, mantenimiento técnico, actualizaciones, seguridad y procesamiento de pago mediante Stripe.';

const legalNotice =
  'OMP Suite NO es una aplicación oficial de los Testigos de Jehová. No está afiliada, respaldada ni relacionada con JW.ORG ni con ninguna entidad oficial.';

export default function LandingScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const styles = createStyles(colors);
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 760;

  const goToLogin = () => {
    router.push('/login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.page}>
          <View style={[styles.hero, isWide && styles.heroWide]}>
            <View style={styles.heroCopy}>
              <ThemedText type="title" style={styles.heroTitle}>
                OMP Suite
              </ThemedText>
              <ThemedText style={styles.heroSubtitle}>
                OMP Suite busca centralizar y simplificar la organización interna de una congregación mediante una app multiplataforma disponible en web, Android e iOS.
              </ThemedText>
              <PrimaryButton label="Acceder al sistema" onPress={goToLogin} />
            </View>
            <View style={styles.productPanel} accessibilityLabel="Resumen visual de modulos OMP Suite">
              <View style={styles.panelHeader}>
                <View style={styles.panelDot} />
                <ThemedText style={styles.panelTitle}>OMP</ThemedText>
              </View>
              <View style={styles.panelGrid}>
                {['Usuarios', 'Reuniones', 'Limpieza', 'Informes'].map((item) => (
                  <View key={item} style={styles.panelTile}>
                    <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
                    <ThemedText style={styles.panelTileText}>{item}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <Section title="Funciones principales">
            <View style={styles.featureGrid}>
              {features.map((feature) => (
                <View key={feature} style={[styles.featurePill, isWide && styles.featurePillWide]}>
                  <Ionicons name="ellipse" size={8} color={colors.primary} />
                  <ThemedText style={styles.featureText}>{feature}</ThemedText>
                </View>
              ))}
            </View>
          </Section>

          <Section title="Seguridad">
            <BulletList items={securityPoints} />
          </Section>

          <Section title="Tecnología">
            <BulletList items={technologyPoints} />
          </Section>

          <Section title="Planes">
            <View style={[styles.planGrid, isWide && styles.planGridWide]}>
              {plans.map((plan) => (
                <View key={plan} style={[styles.planCard, isWide && styles.planCardWide]}>
                  <ThemedText style={styles.planPrice}>{plan}</ThemedText>
                </View>
              ))}
            </View>
            <ThemedText style={styles.paragraph}>{planDescription}</ThemedText>
          </Section>

          <Section title="Por qué se cobra">
            <ThemedText style={styles.paragraph}>{whyPaidText}</ThemedText>
          </Section>

          <View style={styles.legalBlock}>
            <Ionicons name="information-circle-outline" size={22} color={colors.info} />
            <ThemedText style={styles.legalText}>{legalNotice}</ThemedText>
          </View>

          <View style={styles.finalCta}>
            <ThemedText style={styles.finalTitle}>Acceso privado para congregaciones</ThemedText>
            <PrimaryButton label="Acceder al sistema" onPress={goToLogin} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.section}>
      <ThemedText type="subtitle" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function BulletList({ items }: { items: readonly string[] }) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <View style={styles.bulletList}>
      {items.map((item) => (
        <View key={item} style={styles.bulletItem}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
          <ThemedText style={styles.bulletText}>{item}</ThemedText>
        </View>
      ))}
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const colors = useAppColors();
  const styles = createStyles(colors);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
    >
      <ThemedText style={styles.primaryButtonText}>{label}</ThemedText>
      <Ionicons name="arrow-forward-outline" size={18} color={colors.onPrimary} />
    </Pressable>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.backgroundDark,
    },
    scrollContent: {
      flexGrow: 1,
    },
    page: {
      width: '100%',
      maxWidth: Platform.OS === 'web' ? 960 : undefined,
      alignSelf: 'center',
      paddingHorizontal: 20,
      paddingVertical: 28,
      gap: 28,
    },
    hero: {
      gap: 24,
      paddingVertical: 18,
    },
    heroWide: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heroCopy: {
      flex: 1,
      gap: 18,
    },
    heroTitle: {
      color: colors.textPrimary,
      fontSize: 42,
      lineHeight: 48,
    },
    heroSubtitle: {
      color: colors.textSecondary,
      fontSize: 17,
      lineHeight: 26,
      maxWidth: 660,
    },
    productPanel: {
      flex: 1,
      minWidth: Platform.OS === 'web' ? 300 : undefined,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surface,
      padding: 16,
      gap: 16,
      shadowColor: colors.overlay,
      shadowOpacity: Platform.OS === 'web' ? 0 : 0.12,
      shadowRadius: 18,
      elevation: 3,
    },
    panelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    panelDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.primary,
    },
    panelTitle: {
      color: colors.textPrimary,
      fontWeight: '700',
    },
    panelGrid: {
      gap: 10,
    },
    panelTile: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.surfaceBorder,
      borderRadius: 8,
      backgroundColor: colors.surfaceRaised,
      padding: 12,
    },
    panelTileText: {
      color: colors.textSecondary,
      fontWeight: '600',
    },
    section: {
      gap: 14,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 22,
      lineHeight: 28,
    },
    featureGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    featurePill: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    featurePillWide: {
      width: '31.8%',
    },
    featureText: {
      color: colors.textSecondary,
      fontWeight: '600',
      flexShrink: 1,
    },
    bulletList: {
      gap: 10,
    },
    bulletItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    bulletText: {
      flex: 1,
      color: colors.textSecondary,
      lineHeight: 23,
    },
    planGrid: {
      gap: 12,
    },
    planGridWide: {
      flexDirection: 'row',
    },
    planCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surface,
      padding: 16,
      gap: 8,
    },
    planCardWide: {
      flex: 1,
    },
    planPrice: {
      color: colors.primary,
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 25,
    },
    paragraph: {
      color: colors.textSecondary,
      lineHeight: 24,
    },
    legalBlock: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      borderWidth: 1,
      borderColor: colors.info,
      borderRadius: 8,
      backgroundColor: colors.infoLight,
      padding: 16,
    },
    legalText: {
      flex: 1,
      color: colors.textPrimary,
      lineHeight: 23,
      fontWeight: '600',
    },
    finalCta: {
      alignItems: 'flex-start',
      gap: 14,
      paddingTop: 8,
      paddingBottom: 12,
    },
    finalTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: '700',
    },
    primaryButton: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    primaryButtonPressed: {
      opacity: 0.86,
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontWeight: '700',
    },
  });
