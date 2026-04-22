import '../global.css';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect } from 'react';
import { LogBox } from 'react-native';

import { AuthProvider, useAuth } from '@/src/context/auth-context';
import { ThemeModeProvider, useAppTheme } from '@/src/context/theme-context';
import { I18nProvider, useI18n } from '@/src/i18n/index';
import { getAppColors } from '@/src/styles';
import { useNotificationSetup } from '@/src/hooks/use-notification-setup';
import { useInitialPermissions } from '@/src/hooks/use-initial-permissions';
import { useCacheControlCleanup } from '@/src/hooks/use-cache-control-cleanup';

LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications functionality provided by expo-notifications was removed from Expo Go',
]);

export const unstable_settings = {
  initialRouteName: 'index',
};

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const { isReady: i18nReady, hasCompletedLanguageOnboarding } = useI18n();
  const segments = useSegments();
  const router = useRouter();

  // Request initial permissions once on app mount.
  useInitialPermissions();

  // Initialize push notifications when user is authenticated.
  useNotificationSetup({
    uid: user?.uid ?? null,
    isAuthenticated: !!user,
  });

  // Controlled cleanup for temporary cache.
  useCacheControlCleanup();

  useEffect(() => {
    if (!i18nReady) {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    const inLanguageSetup = segments[0] === 'language-setup';

    // First launch gate: force language selection once before any auth flow.
    if (!hasCompletedLanguageOnboarding) {
      if (!inLanguageSetup) {
        router.replace('/language-setup');
      }
      return;
    }

    if (loading) {
      return;
    }

    if (inLanguageSetup) {
      router.replace(user ? ('/(protected)/(tabs)/' as any) : '/(auth)/login');
      return;
    }

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(protected)/(tabs)/' as any);
    }
  }, [
    user,
    loading,
    segments,
    router,
    i18nReady,
    hasCompletedLanguageOnboarding,
  ]);

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="language-setup" options={{ headerShown: false }} />
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
        <I18nProvider>
          <RootLayoutNav />
        </I18nProvider>
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
