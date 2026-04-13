import '../global.css';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';
import { LogBox } from 'react-native';

LogBox.ignoreLogs([
  "expo-notifications: Android Push notifications functionality provided by expo-notifications was removed from Expo Go",
]);

import { AuthProvider, useAuth } from '@/src/context/auth-context';
import { ThemeModeProvider, useAppTheme } from '@/src/context/theme-context';
import { getAppColors } from '@/src/styles';
import { useNotificationSetup } from '@/src/hooks/use-notification-setup';
import { useInitialPermissions } from '@/src/hooks/use-initial-permissions';

export const unstable_settings = {
  initialRouteName: 'index',
};

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Solicitar permisos iniciales al montar la app (solo la primera vez)
  useInitialPermissions();

  // Inicializar notificaciones push en segundo plano cuando el usuario se autentica
  useNotificationSetup({
    uid: user?.uid ?? null,
    isAuthenticated: !!user,
  });

  useEffect(() => {
    if (loading) {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Usuario no autenticado → redirigir a login
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Usuario autenticado → redirigir a dashboard con tabs
      router.replace('/(protected)/(tabs)/' as any);
    }
  }, [user, loading, segments]);

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(protected)" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
    </Stack>
  );
}

const navigationLight = getAppColors('light');
const navigationDark = getAppColors('dark');

const NavigationThemes = {
  light: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: navigationLight.primary,
      background: navigationLight.backgroundDark,
      card: navigationLight.tabBar,
      text: navigationLight.textPrimary,
      border: navigationLight.border,
      notification: navigationLight.error,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: navigationDark.primary,
      background: navigationDark.backgroundDark,
      card: navigationDark.tabBar,
      text: navigationDark.textPrimary,
      border: navigationDark.border,
      notification: navigationDark.error,
    },
  },
} as const;

function AppLayout() {
  const { colorScheme, isReady } = useAppTheme();
  const colors = getAppColors(colorScheme);

  if (!isReady) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? NavigationThemes.dark : NavigationThemes.light}>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
      <StatusBar
        style={colorScheme === 'dark' ? 'light' : 'dark'}
        translucent={false}
        backgroundColor={colors.backgroundDark}
      />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeModeProvider>
      <AppLayout />
    </ThemeModeProvider>
  );
}
