import { Stack, useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/src/context/auth-context';
import { UserProvider, useUser } from '@/src/context/user-context';
import { useNotificationDeepLink } from '@/src/hooks/use-notification-deep-link';
import { useNotificationSetup } from '@/src/hooks/use-notification-setup';
import { useStartupPermissionPrompt } from '@/src/hooks/use-startup-permission-prompt';
import { useI18n } from '@/src/i18n/index';
import { LoadingState } from '@/src/components/common/LoadingState';
import { CongregationBlockedScreen } from '@/src/screens/errors/CongregationBlockedScreen';
import { SystemAnnouncementGate } from '@/src/components/announcements/SystemAnnouncementGate';
import { InactivityWarningModal } from '@/src/components/session/InactivityWarningModal';
import { buildPathWithParams } from '@/src/utils/navigation/redirect';
import { CleaningCacheProvider } from '@/src/modules/cleaning/context/CleaningCacheContext';

function ProtectedNotificationSetup() {
  const { uid, congregationId, isSessionValid } = useUser();

  useNotificationSetup({
    uid,
    congregationId,
    isAuthenticated: isSessionValid,
  });
  useStartupPermissionPrompt({
    uid,
    congregationId,
    isAuthenticated: isSessionValid,
  });
  useNotificationDeepLink();

  return null;
}

export default function ProtectedLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useGlobalSearchParams();

  useEffect(() => {
    if (loading || user) {
      return;
    }

    router.replace({
      pathname: '/login',
      params: {
        redirectTo: buildPathWithParams(pathname, searchParams),
      },
    });
  }, [loading, pathname, router, searchParams, user]);

  if (loading || !user) {
    return <LoadingState message="Verificando acceso..." />;
  }

  return (
    <UserProvider>
      <CleaningCacheProvider>
        <ProtectedContent />
      </CleaningCacheProvider>
    </UserProvider>
  );
}

function ProtectedContent() {
  const { t } = useI18n();
  const { congregationAccess, loadingProfile } = useUser();
  const { showInactivityWarning, secondsLeft, extendSession, logout } = useAuth();

  if (loadingProfile) {
    return <LoadingState message="Verificando acceso..." />;
  }

  if (congregationAccess?.isBlocked) {
    return <CongregationBlockedScreen access={congregationAccess} />;
  }

  return (
    <>
      <ProtectedNotificationSetup />
      <SystemAnnouncementGate />
      <InactivityWarningModal
        visible={showInactivityWarning}
        secondsLeft={secondsLeft}
        onExtendSession={extendSession}
        onLogout={() => void logout()}
      />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="users/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="users/create" options={{ headerShown: false }} />
        <Stack.Screen name="users/edit/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="meetings/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="meetings/create" options={{ headerShown: false }} />
        <Stack.Screen name="meetings/edit/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="meetings/manage" options={{ headerShown: false }} />
        <Stack.Screen name="meetings/midweek" options={{ headerShown: false }} />
        <Stack.Screen name="meetings/midweek/create" options={{ headerShown: false }} />
        <Stack.Screen name="meetings/midweek/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="assignments/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="assignments/create" options={{ headerShown: false }} />
        <Stack.Screen name="assignments/edit/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="assignments/outgoing-talks" options={{ headerShown: false }} />
        <Stack.Screen name="assignments/hospitality-microphones" options={{ headerShown: false }} />
        <Stack.Screen name="assignments/readers" options={{ headerShown: false }} />
        <Stack.Screen name="events/create" options={{ headerShown: false }} />
        <Stack.Screen name="events/edit/[id]" options={{ headerShown: false }} />
        {/* Módulo de limpieza */}
        <Stack.Screen name="cleaning/index" options={{ headerShown: false }} />
        <Stack.Screen name="cleaning/create" options={{ headerShown: false }} />
        <Stack.Screen name="cleaning/schedule" options={{ headerShown: false }} />
        <Stack.Screen name="cleaning/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="cleaning/edit/[id]" options={{ headerShown: false }} />
        {/* Módulo: Contador de Horas de Predicación (100% local, sin Firebase) */}
        <Stack.Screen name="field-service" options={{ headerShown: false }} />
        <Stack.Screen name="preaching/manager" options={{ headerShown: false }} />
        <Stack.Screen name="preaching/territories" options={{ headerShown: false }} />
        <Stack.Screen name="preaching/territories/manage" options={{ headerShown: false }} />
        <Stack.Screen name="territories/index" options={{ headerShown: false }} />
        <Stack.Screen name="territories/manage" options={{ headerShown: false }} />
        <Stack.Screen name="notifications/index" options={{ headerShown: false }} />
        <Stack.Screen name="organization-chart" options={{ headerShown: false }} />
        <Stack.Screen name="billing/index" options={{ headerShown: false }} />
        <Stack.Screen name="billing/success" options={{ headerShown: false }} />
        <Stack.Screen name="billing/cancel" options={{ headerShown: false }} />
        <Stack.Screen name="unauthorized" options={{ headerShown: false }} />
        {/* Settings */}
        <Stack.Screen
          name="settings/theme"
          options={{ title: t('settings.screen.theme'), headerShown: false }}
        />
        <Stack.Screen
          name="settings/language"
          options={{ title: t('settings.screen.language'), headerShown: false }}
        />
        <Stack.Screen
          name="settings/about"
          options={{ title: t('settings.screen.about'), headerShown: false }}
        />
      </Stack>
    </>
  );
}
