import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { type EdgeInsets, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/src/components/themed-text';
import { type AppColors as AppColorSet, useAppColors } from '@/src/styles';

const WELCOME_ACCEPTED_KEY_PREFIX = '@omp/first-login-welcome-accepted-v1';
const CONTACT_EMAIL = '[correo de contacto]';

interface FirstLoginWelcomeModalProps {
  uid: string | null;
  enabled: boolean;
}

export function FirstLoginWelcomeModal({ uid, enabled }: FirstLoginWelcomeModalProps) {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const maxCardHeight = Math.max(360, height - insets.top - insets.bottom - 32);
  const styles = useMemo(
    () => createStyles(colors, insets, maxCardHeight),
    [colors, insets, maxCardHeight]
  );
  const [visible, setVisible] = useState(false);
  const [storageKey, setStorageKey] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || !enabled) {
      setVisible(false);
      setStorageKey(null);
      return;
    }

    let cancelled = false;
    const key = `${WELCOME_ACCEPTED_KEY_PREFIX}:${uid}`;
    setStorageKey(key);

    const loadAcceptedState = async () => {
      try {
        const accepted = await AsyncStorage.getItem(key);
        if (!cancelled) {
          setVisible(accepted !== '1');
        }
      } catch {
        if (!cancelled) {
          setVisible(true);
        }
      }
    };

    void loadAcceptedState();

    return () => {
      cancelled = true;
    };
  }, [enabled, uid]);

  const handleAccept = async () => {
    setVisible(false);

    if (!storageKey) return;

    try {
      await AsyncStorage.setItem(storageKey, '1');
    } catch {
      // If persistence fails, keep the session moving and try again on next launch.
    }
  };

  return (
    <Modal
      animationType="fade"
      navigationBarTranslucent
      onRequestClose={() => undefined}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="heart-outline" size={30} color={colors.primary} />
            </View>
            <View style={styles.headerText}>
              <ThemedText style={styles.kicker}>OMP</ThemedText>
              <ThemedText style={styles.title}>¡Bienvenido, hermano/a!</ThemedText>
            </View>
          </View>

          <ScrollView
            bounces={false}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            style={styles.scroller}
          >
            <ThemedText style={styles.paragraph}>
              Espero que puedas disfrutar de OMP y que esta herramienta te ayude a tener un
              mejor control de tus asignaciones, reuniones y responsabilidades dentro de la
              congregación.
            </ThemedText>

            <View style={styles.notice}>
              <Ionicons name="information-circle-outline" size={20} color={colors.info} />
              <ThemedText style={styles.noticeText}>
                OMP no es una aplicación oficial de los Testigos de Jehová. No está afiliada,
                respaldada ni relacionada con JW.ORG ni con ninguna entidad oficial de los
                Testigos de Jehová.
              </ThemedText>
            </View>

            <ThemedText style={styles.paragraph}>
              Es una herramienta independiente, desarrollada con respeto y mucho cariño, con el
              único propósito de facilitar la organización y apoyar de manera práctica a quienes
              la utilizan.
            </ThemedText>

            <ThemedText style={styles.paragraph}>
              Este proyecto sigue creciendo poco a poco. Si tienes ideas, sugerencias o
              comentarios que puedan ayudar a mejorar OMP en el futuro, puedes ponerte en
              contacto al siguiente correo:
            </ThemedText>

            <View style={styles.emailBox}>
              <Ionicons name="mail-outline" size={18} color={colors.primary} />
              <Text style={styles.emailText}>{CONTACT_EMAIL}</Text>
            </View>

            <ThemedText style={styles.paragraph}>
              Gracias por usar OMP. Espero sinceramente que te sea útil y que pueda aportar un
              poco de orden y apoyo en tus actividades.
            </ThemedText>

            <ThemedText style={styles.signature}>
              Con cariño para mis hermanos,{'\n\n'}MRC{'\n'}Desarrollador de OMP
            </ThemedText>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Aceptar mensaje de bienvenida"
              onPress={handleAccept}
              style={({ pressed }) => [
                styles.acceptButton,
                pressed && styles.acceptButtonPressed,
              ]}
            >
              <ThemedText style={styles.acceptButtonText}>Aceptar</ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: AppColorSet, insets: EdgeInsets, maxCardHeight: number) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
      paddingTop: Math.max(insets.top + 12, 18),
      paddingBottom: Math.max(insets.bottom + 12, 18),
      backgroundColor: colors.overlay,
    },
    card: {
      width: '100%',
      maxWidth: 520,
      maxHeight: maxCardHeight,
      overflow: 'hidden',
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.22,
      shadowRadius: 28,
      elevation: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 22,
      paddingTop: 24,
      paddingBottom: 18,
      backgroundColor: colors.backgroundMedium,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.infoLight,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
    },
    kicker: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0,
      marginBottom: 4,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: '800',
      lineHeight: 29,
    },
    scroller: {
      flexShrink: 1,
    },
    content: {
      gap: 14,
      padding: 22,
      paddingBottom: 18,
    },
    paragraph: {
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
    },
    notice: {
      flexDirection: 'row',
      gap: 10,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.infoLight,
    },
    noticeText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    emailBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceRaised,
    },
    emailText: {
      flex: 1,
      color: colors.primary,
      fontSize: 15,
      fontWeight: '700',
    },
    signature: {
      color: colors.textPrimary,
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '600',
    },
    footer: {
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: Math.max(insets.bottom, 10) + 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    acceptButton: {
      minHeight: 50,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    acceptButtonPressed: {
      opacity: 0.85,
    },
    acceptButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '800',
      lineHeight: 22,
    },
  });
