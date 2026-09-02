import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '@/src/context/auth-context';
import { syncCacheCleanupControl } from '@/src/services/cache/cache-control-service';

/**
 * Revisa al iniciar sesión si backend solicitó limpieza de caché temporal.
 * Nunca borra sesión, tokens de auth ni preferencias persistentes.
 */
export function useCacheControlCleanup(): void {
  const { loading, user } = useAuth();
  const lastSyncedAtRef = useRef(0);

  useEffect(() => {
    if (loading) return;

    const uid = user?.uid ?? null;
    if (!uid) return;

    const sync = (): void => {
      // Una lectura al volver al foreground, con límite para rebotes de AppState.
      if (Date.now() - lastSyncedAtRef.current < 60_000) return;
      lastSyncedAtRef.current = Date.now();
      void syncCacheCleanupControl();
    };

    sync();
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') sync();
    });

    return () => subscription.remove();
  }, [loading, user?.uid]);
}
