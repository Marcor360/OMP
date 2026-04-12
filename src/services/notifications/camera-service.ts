/**
 * Servicio de permisos de cámara y galería usando expo-image-picker.
 * expo-image-picker viene incluido en el SDK de Expo sin instalación adicional.
 */
import * as ImagePicker from 'expo-image-picker';
import { Platform, Linking } from 'react-native';

import { PermissionStatus } from '@/src/types/permissions.types';

// ─── Verificar estado de cámara ───────────────────────────────────────────────

export async function getCameraPermissionStatus(): Promise<PermissionStatus> {
  if (Platform.OS === 'web') return 'unavailable';

  try {
    const { status } = await ImagePicker.getCameraPermissionsAsync();
    return mapStatus(status);
  } catch {
    return 'unavailable';
  }
}

// ─── Solicitar permiso de cámara ──────────────────────────────────────────────

export async function requestCameraPermission(): Promise<PermissionStatus> {
  if (Platform.OS === 'web') return 'unavailable';

  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return mapStatus(status);
  } catch {
    return 'denied';
  }
}

// ─── Verificar permiso de galería ─────────────────────────────────────────────

export async function getMediaLibraryPermissionStatus(): Promise<PermissionStatus> {
  if (Platform.OS === 'web') return 'unavailable';

  try {
    const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
    return mapStatus(status);
  } catch {
    return 'unavailable';
  }
}

// ─── Solicitar permiso de galería ─────────────────────────────────────────────

export async function requestMediaLibraryPermission(): Promise<PermissionStatus> {
  if (Platform.OS === 'web') return 'unavailable';

  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return mapStatus(status);
  } catch {
    return 'denied';
  }
}

// ─── Abrir configuración del SO ───────────────────────────────────────────────

export async function openAppSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // Silencioso en plataformas no soportadas
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function mapStatus(raw: string): PermissionStatus {
  if (raw === 'granted') return 'granted';
  if (raw === 'denied') return 'denied';
  return 'undetermined';
}
