/**
 * Envoltorio de expo-local-authentication. Gestiona exclusivamente la
 * autenticacion LOCAL del dispositivo (huella, Face ID, o el codigo/PIN/patron
 * del sistema como respaldo). Nunca crea ni valida credenciales de Firebase:
 * solo confirma que quien sostiene el telefono es su dueno.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export interface BiometricAvailability {
  hasHardware: boolean;
  isEnrolled: boolean;
}

export type BiometricAuthOutcome =
  | { success: true }
  | {
      success: false;
      reason: 'canceled' | 'lockout' | 'unavailable' | 'failed';
      errorCode?: LocalAuthentication.LocalAuthenticationError;
    };

export const getBiometricAvailability = async (): Promise<BiometricAvailability> => {
  if (Platform.OS === 'web') {
    return { hasHardware: false, isEnrolled: false };
  }

  try {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return { hasHardware, isEnrolled };
  } catch {
    return { hasHardware: false, isEnrolled: false };
  }
};

export const authenticateLocally = async (options: {
  promptMessage: string;
  cancelLabel: string;
}): Promise<BiometricAuthOutcome> => {
  if (Platform.OS === 'web') {
    return { success: false, reason: 'unavailable' };
  }

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: options.promptMessage,
      cancelLabel: options.cancelLabel,
      // Permite que el sistema ofrezca codigo/PIN/patron del dispositivo como
      // respaldo cuando la biometria falla o no esta configurada.
      disableDeviceFallback: false,
    });

    if (result.success) {
      return { success: true };
    }

    switch (result.error) {
      case 'user_cancel':
      case 'app_cancel':
      case 'system_cancel':
      case 'user_fallback':
        return { success: false, reason: 'canceled', errorCode: result.error };
      case 'lockout':
        return { success: false, reason: 'lockout', errorCode: result.error };
      case 'not_available':
      case 'not_enrolled':
      case 'passcode_not_set':
        return { success: false, reason: 'unavailable', errorCode: result.error };
      default:
        return { success: false, reason: 'failed', errorCode: result.error };
    }
  } catch {
    return { success: false, reason: 'failed' };
  }
};
