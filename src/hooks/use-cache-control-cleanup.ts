import { useEffect, useRef } from 'react';

import { useAuth } from '@/src/context/auth-context';
import { syncCacheCleanupControl } from '@/src/services/cache/cache-control-service';

/**
 * Revisa al iniciar sesión si backend solicitó limpieza de caché temporal.
 * Nunca borra sesión, tokens de auth ni preferencias persistentes.
 */
export function useCacheControlCleanup(): void {
  const { loading, user } = useAuth();
  const lastSyncedUidRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;

    const uid = user?.uid ?? null;
    if (!uid) {
      lastSyncedUidRef.current = null;
      return;
    }

    if (lastSyncedUidRef.current === uid) return;
    lastSyncedUidRef.current = uid;

    void syncCacheCleanupControl();
  }, [loading, user?.uid]);
}
