import '../global.css';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useGlobalSearchParams, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { LogBox, Platform } from 'react-native';

import { AuthProvider, useAuth } from '@/src/context/auth-context';
import { ThemeModeProvider, useAppTheme } from '@/src/context/theme-context';
import { ToastProvider } from '@/src/context/toast-context';
import { I18nProvider, useI18n } from '@/src/i18n/index';
import { getAppColors } from '@/src/styles';
import { useInitialPermissions } from '@/src/hooks/use-initial-permissions';
import { useCacheControlCleanup } from '@/src/hooks/use-cache-control-cleanup';
import { configureGlobalNotificationHandler } from '@/src/services/notifications/push-notifications.service';
import { initializePersistentCacheCycle } from '@/src/services/repositories/persistent-cache';
import { canUseRemotePushNotifications } from '@/src/utils/runtime';
import { buildPathWithParams, getSafeRedirectPath } from '@/src/utils/navigation/redirect';

// Prevenir que el splash se oculte automáticamente
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

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
  const pathname = usePathname();
  const searchParams = useGlobalSearchParams();
  const router = useRouter();
  const [appReady, setAppReady] = useState(false);
  const [splashHidden, setSplashHidden] = useState(false);

  // Request initial permissions once on app mount.
  useInitialPermissions();

  useEffect(() => {
    configureGlobalNotificationHandler();
  }, []);

  useEffect(() => {
    if (!canUseRemotePushNotifications) {
      return;
    }

    let subscription: { remove: () => void } | null = null;
    let cancelled = false;

    void import('expo-notifications').then((Notifications) => {
      if (cancelled) return;

      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const url = response.notification.request.content.data?.url;

        if (typeof url === 'string' && url.startsWith('/')) {
          router.push(url as never);
        }
      });
    });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [router]);

  // Controlled cleanup for temporary cache.
  useCacheControlCleanup();


  // Determinar si la app está lista para navegar
  useEffect(() => {
    if (!i18nReady) return;

    // Si ya completó onboarding de idioma y auth terminó de cargar (o timeout)
    if (hasCompletedLanguageOnboarding && !loading) {
      setAppReady(true);
    } else if (hasCompletedLanguageOnboarding && loading) {
      // Auth aún cargando, esperar
      return;
    } else if (!hasCompletedLanguageOnboarding) {
      // Ir a language-setup inmediatamente
      setAppReady(true);
    }
  }, [i18nReady, loading, hasCompletedLanguageOnboarding]);

  // Ocultar splash cuando appReady sea true
  useEffect(() => {
    if (appReady && !splashHidden && Platform.OS !== 'web') {
      SplashScreen.hideAsync()
        .then(() => setSplashHidden(true))
        .catch(() => setSplashHidden(true));
    }
  }, [appReady, splashHidden]);

  // Navegación condicional
  useEffect(() => {
    if (!appReady) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inLanguageSetup = segments[0] === 'language-setup';
    const inProtectedGroup = segments[0] === '(protected)';
    const currentPath = buildPathWithParams(pathname, searchParams);

    if (!hasCompletedLanguageOnboarding) {
      if (!inLanguageSetup) {
        router.replace('/language-setup');
      }
      return;
    }

    if (inLanguageSetup) {
      router.replace(user ? ('/(protected)/(tabs)/' as any) : '/login');
      return;
    }

    if (!user && inProtectedGroup) {
      // Sin sesión y fuera del grupo auth → ir a login
      router.replace({
        pathname: '/login',
        params: { redirectTo: currentPath },
      });
    } else if (!user && !inAuthGroup) {
      router.replace('/login');
    } else if (user && inAuthGroup) {
      // Con sesión y en pantalla de auth → ir a tabs
      router.replace(getSafeRedirectPath(searchParams.redirectTo) as any);
    } else if (user && !inProtectedGroup && !inAuthGroup && !inLanguageSetup) {
      // Con sesión pero en index u otra ruta no protegida (ej: primera carga) → ir a tabs
      router.replace('/(protected)/(tabs)/' as any);
    }
  }, [
    appReady,
    user,
    segments,
    pathname,
    searchParams,
    router,
    hasCompletedLanguageOnboarding,
  ]);

  // Mostrar splash mientras app no está lista
  if (!appReady || !i18nReady) {
    return null;
  }

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
  const [forceReady, setForceReady] = useState(false);
  const [persistentCacheReady, setPersistentCacheReady] = useState(false);

  // Timeout de seguridad: si el tema tarda más de 2s, ignoramos isReady
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isReady) {
        console.warn('[AppLayout] Timeout de tema alcanzado (2s). Forzando render.');
        setForceReady(true);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [isReady]);

  useEffect(() => {
    let cancelled = false;

    initializePersistentCacheCycle()
      .catch((error) => {
        console.warn('[AppLayout] No se pudo inicializar cache persistente.', error);
      })
      .finally(() => {
        if (!cancelled) {
          setPersistentCacheReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if ((!isReady && !forceReady) || !persistentCacheReady) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? NavigationThemes.dark : NavigationThemes.light}>
      <AuthProvider>
        <I18nProvider>
          <ToastProvider>
            <RootLayoutNav />
          </ToastProvider>
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
